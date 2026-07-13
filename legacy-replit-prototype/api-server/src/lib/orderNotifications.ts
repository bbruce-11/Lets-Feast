import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { logger } from "./logger";
import { OFFSETS_MS } from "./orderStatus";
import { sendPushToUser } from "./push";

// Statuses that should trigger a customer notification, in chronological order.
// "confirmed" is intentionally excluded — the customer just placed the order and
// is looking at the confirmation screen, so it is handled in-app only.
const NOTIFY_STATUSES = ["preparing", "driver_assigned", "on_the_way", "delivered"] as const;
type NotifyStatus = (typeof NOTIFY_STATUSES)[number];

const COPY: Record<NotifyStatus, { title: string; body: string }> = {
  preparing: {
    title: "👨‍🍳 Your order is being prepared",
    body: "The kitchen has started cooking up your feast.",
  },
  driver_assigned: {
    title: "🚗 Driver assigned",
    body: "Your driver is heading to the restaurant to pick up your order.",
  },
  on_the_way: {
    title: "🍽️ Your feast is on the way",
    body: "Your order has been picked up and is heading to you.",
  },
  delivered: {
    title: "🎉 Delivered!",
    body: "Your feast has arrived. Enjoy!",
  },
};

// How recently the tracking screen must have polled for us to treat the app as
// "actively open". While open, the in-app local notification handles the update,
// so the server suppresses the push to avoid a duplicate.
export const ACTIVE_WINDOW_MS = 12_000;

// Transitions older than this are considered stale and are marked handled
// without pushing. This prevents a burst of out-of-date notifications when the
// feature first ships (historical/seed orders) or after a long server outage —
// nobody wants a "Delivered!" alert for a meal they ate hours ago.
export const MAX_CATCHUP_AGE_MS = 5 * 60_000;

interface OrderRow {
  id: number;
  userId: number;
  createdAt: Date | string;
  status: string;
  statusManual: boolean;
  notifiedStatus: string | null;
  lastPolledAt: Date | string | null;
}

// One pending timer per order (the next future status transition). Keyed by
// order id so the periodic re-scan never double-schedules.
const timers = new Map<number, ReturnType<typeof setTimeout>>();
// Guards against the re-scan and a firing timer handling the same status at once.
const handling = new Set<number>();

function statusIndex(status: string | null): number {
  if (!status) return -1;
  return (NOTIFY_STATUSES as readonly string[]).indexOf(status);
}

function toMs(value: Date | string | null): number | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  const ms = d.getTime();
  return Number.isNaN(ms) ? null : ms;
}

// Decides whether a push should actually be delivered for a status transition.
// We skip when the tracking screen is open right now (it shows the in-app
// notification) and when the app was alive at/after the transition occurred (it
// already showed it before going away). Otherwise the app missed it → push.
export function shouldPush(activationMs: number, now: number, lastPolledMs: number | null): boolean {
  if (now - activationMs > MAX_CATCHUP_AGE_MS) return false;
  if (lastPolledMs != null && now - lastPolledMs <= ACTIVE_WINDOW_MS) return false;
  if (lastPolledMs != null && activationMs <= lastPolledMs) return false;
  return true;
}

async function fetchOrder(orderId: number): Promise<OrderRow | null> {
  const [row] = await db
    .select({
      id: ordersTable.id,
      userId: ordersTable.userId,
      createdAt: ordersTable.createdAt,
      status: ordersTable.status,
      statusManual: ordersTable.statusManual,
      notifiedStatus: ordersTable.notifiedStatus,
      lastPolledAt: ordersTable.lastPolledAt,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  return row ?? null;
}

function clearTimer(orderId: number): void {
  const handle = timers.get(orderId);
  if (handle) {
    clearTimeout(handle);
    timers.delete(orderId);
  }
}

// Processes all currently-due transitions for an order (sending/suppressing each
// and persisting progress), then schedules a timer for the next future one.
async function scheduleOrder(orderId: number): Promise<void> {
  if (handling.has(orderId)) return;
  handling.add(orderId);
  try {
    let order = await fetchOrder(orderId);
    if (!order) {
      clearTimer(orderId);
      return;
    }
    if (order.status === "cancelled") {
      clearTimer(orderId);
      return;
    }
    // Manually-controlled orders no longer follow the elapsed-time schedule;
    // their notifications are sent on demand by notifyManualStatus(). Drop any
    // pending time-based timer so it can't fire a stale, premature push.
    if (order.statusManual) {
      clearTimer(orderId);
      return;
    }

    const createdMs = toMs(order.createdAt);
    if (createdMs == null) {
      clearTimer(orderId);
      return;
    }

    for (let i = statusIndex(order.notifiedStatus) + 1; i < NOTIFY_STATUSES.length; i++) {
      const status = NOTIFY_STATUSES[i]!;
      const activationMs = createdMs + OFFSETS_MS[status];
      const now = Date.now();
      const delay = activationMs - now;

      if (delay > 0) {
        // Earliest future transition — (re)schedule a single timer for it.
        clearTimer(orderId);
        const handle = setTimeout(() => {
          timers.delete(orderId);
          void scheduleOrder(orderId).catch((err) =>
            logger.error({ err, orderId }, "order notification timer error"),
          );
        }, delay);
        timers.set(orderId, handle);
        return;
      }

      // Transition is due now (live or catch-up). Decide push vs. suppress using
      // the latest presence signal, then mark it handled.
      const lastPolledMs = toMs(order.lastPolledAt);
      if (shouldPush(activationMs, now, lastPolledMs)) {
        const copy = COPY[status];
        await sendPushToUser(order.userId, {
          title: copy.title,
          body: copy.body,
          data: { type: "order_status", orderId: order.id, status },
        });
      } else {
        logger.debug(
          { orderId: order.id, status },
          "suppressing order push (app active or already seen)",
        );
      }

      await db
        .update(ordersTable)
        .set({ notifiedStatus: status, updatedAt: new Date() })
        .where(eq(ordersTable.id, order.id));
      order = { ...order, notifiedStatus: status };
    }

    // All transitions handled (delivered notified).
    clearTimer(orderId);
  } finally {
    handling.delete(orderId);
  }
}

// Scans for orders that still have pending notifications and (re)schedules them.
// Safe to call repeatedly: in-flight timers and the persisted notifiedStatus
// prevent duplicate work. Mirrors the expiry broadcaster's catch-up pattern so
// scheduling survives server restarts.
export async function scheduleOrderNotifications(): Promise<void> {
  try {
    const rows = await db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(
        and(
          ne(ordersTable.status, "cancelled"),
          or(isNull(ordersTable.notifiedStatus), ne(ordersTable.notifiedStatus, "delivered")),
        ),
      );

    for (const row of rows) {
      await scheduleOrder(row.id).catch((err) =>
        logger.error({ err, orderId: row.id }, "order notification schedule error"),
      );
    }
  } catch (err) {
    logger.error({ err }, "order notification scan error");
  }
}

// Called right after an order is created so its notifications are scheduled
// immediately rather than waiting for the next periodic scan.
export function scheduleOrderById(orderId: number): void {
  void scheduleOrder(orderId).catch((err) =>
    logger.error({ err, orderId }, "order notification initial schedule error"),
  );
}

// Sends the customer push for a manually-set status (restaurant/driver staff
// advancing the order). Reuses the same suppression rules and once-per-status
// bookkeeping as the time-based scheduler so manual control behaves identically
// from the customer's perspective.
async function notifyManualStatusInner(orderId: number, status: string): Promise<void> {
  if (handling.has(orderId)) return;
  handling.add(orderId);
  try {
    const order = await fetchOrder(orderId);
    if (!order) return;
    // A manual update supersedes any pending time-based timer.
    clearTimer(orderId);

    const idx = statusIndex(status);
    // Only notify for statuses that warrant a push and that haven't already
    // been notified (advancing forward only — moving backward sends nothing).
    if (idx < 0 || idx <= statusIndex(order.notifiedStatus)) return;

    const now = Date.now();
    const lastPolledMs = toMs(order.lastPolledAt);
    // Manual updates activate "now", so the catch-up age check always passes;
    // we still respect the active-app suppression so we don't double up with the
    // in-app notification.
    if (shouldPush(now, now, lastPolledMs)) {
      const copy = COPY[status as NotifyStatus];
      await sendPushToUser(order.userId, {
        title: copy.title,
        body: copy.body,
        data: { type: "order_status", orderId: order.id, status },
      });
    } else {
      logger.debug(
        { orderId: order.id, status },
        "suppressing manual order push (app active or already seen)",
      );
    }

    await db
      .update(ordersTable)
      .set({ notifiedStatus: status, updatedAt: new Date() })
      .where(eq(ordersTable.id, order.id));
  } finally {
    handling.delete(orderId);
  }
}

export function notifyManualStatus(orderId: number, status: string): void {
  void notifyManualStatusInner(orderId, status).catch((err) =>
    logger.error({ err, orderId, status }, "manual order notification error"),
  );
}

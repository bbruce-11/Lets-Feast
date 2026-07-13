import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { and, gt, ne } from "drizzle-orm";
import { broadcast, getWss } from "./ws";
import { logger } from "./logger";
import {
  deriveDriverProgress,
  deriveEtaMinutes,
  deriveOrderStatus,
  etaForStatus,
  isTerminal,
  progressForStatus,
} from "./orderStatus";

// The live-tracking fields pushed to clients over the WebSocket. These mirror
// the response-only fields attached by `withTracking()` in the orders route, so
// the client can update the driver marker and ETA without a fresh GET.
export interface OrderTrackingPayload {
  id: number;
  status: string;
  driverProgress: number;
  etaMinutes: number;
}

interface TrackingRow {
  id: number;
  status: string;
  statusManual: boolean;
  createdAt: Date | string;
}

// Computes the display tracking for an order using the same rules as the HTTP
// path: manual orders derive from their staff-set status, time-based orders
// derive from elapsed time. Unlike the GET path this does NOT persist the
// derived status — it is display-only — but it surfaces the time-appropriate
// status so the client sees transitions the instant they happen.
function computeTracking(order: TrackingRow): OrderTrackingPayload {
  if (order.statusManual) {
    const delivered = order.status === "delivered";
    return {
      id: order.id,
      status: order.status,
      driverProgress: delivered ? 1 : progressForStatus(order.status),
      etaMinutes: delivered ? 0 : etaForStatus(order.status),
    };
  }
  const createdAt =
    order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
  const status = deriveOrderStatus(createdAt);
  const delivered = status === "delivered";
  return {
    id: order.id,
    status,
    driverProgress: delivered ? 1 : deriveDriverProgress(createdAt),
    etaMinutes: delivered ? 0 : deriveEtaMinutes(createdAt),
  };
}

// Pushes a single order's current tracking to all connected clients. Used for
// an immediate update right after a manual status change so the customer's map
// reacts instantly instead of waiting for the next periodic tick.
export function broadcastOrderUpdate(order: TrackingRow): void {
  broadcast({ type: "order_update", data: computeTracking(order) });
}

// Only orders created within this window are scanned. The status simulation
// completes quickly (delivered well under a few minutes), so a generous window
// keeps the scan cheap while still covering every order a customer could
// realistically be watching.
const ACTIVE_WINDOW_MS = 10 * 60_000;

// Remembers the last status broadcast per order so a terminal (delivered) order
// is announced exactly once and then drops out of the tick, rather than being
// re-broadcast forever.
const lastBroadcastStatus = new Map<number, string>();

// Computes and broadcasts live tracking for every active order. Non-terminal
// orders are pushed every tick (their progress advances continuously); a
// terminal order is pushed once when it first reaches that state. Skips all work
// when nobody is connected so it costs nothing while idle.
export async function broadcastActiveOrderTracking(): Promise<void> {
  const wss = getWss();
  if (!wss || wss.clients.size === 0) return;

  try {
    const since = Date.now() - ACTIVE_WINDOW_MS;
    const rows = await db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        statusManual: ordersTable.statusManual,
        createdAt: ordersTable.createdAt,
      })
      .from(ordersTable)
      .where(and(ne(ordersTable.status, "cancelled"), gt(ordersTable.createdAt, new Date(since))));

    const seen = new Set<number>();
    for (const row of rows) {
      seen.add(row.id);
      const payload = computeTracking(row);
      if (isTerminal(payload.status)) {
        if (lastBroadcastStatus.get(row.id) === payload.status) continue;
        lastBroadcastStatus.set(row.id, payload.status);
      } else {
        lastBroadcastStatus.set(row.id, payload.status);
      }
      broadcast({ type: "order_update", data: payload });
    }

    // Forget orders that have aged out of the window so the Map can't grow
    // without bound.
    for (const id of lastBroadcastStatus.keys()) {
      if (!seen.has(id)) lastBroadcastStatus.delete(id);
    }
  } catch (err) {
    logger.error({ err }, "order tracking broadcast error");
  }
}

let tickHandle: ReturnType<typeof setInterval> | null = null;

// Starts the periodic tracking broadcaster. Idempotent — calling it twice will
// not create a second interval.
export function startOrderTrackingBroadcasts(intervalMs = 1_000): void {
  if (tickHandle) return;
  tickHandle = setInterval(() => {
    broadcastActiveOrderTracking().catch((err) =>
      logger.error({ err }, "order tracking tick error"),
    );
  }, intervalMs);
}

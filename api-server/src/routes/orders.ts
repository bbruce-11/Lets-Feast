import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable, restaurantsTable, orderItemsTable, usersTable } from "@workspace/db/schema";
import { eq, and, isNotNull, sql, notInArray } from "drizzle-orm";
import { requireAuth, requireRole, requireStaff, type AuthRequest } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { placeOrderSchema, updateOrderStatusSchema, rateOrderSchema } from "../lib/schemas.js";
import {
  deriveOrderStatus,
  deriveDriverProgress,
  deriveEtaMinutes,
  isTerminal,
  isValidStatus,
  nextStatus,
  progressForStatus,
  etaForStatus,
} from "../lib/orderStatus.js";
import { scheduleOrderById, notifyManualStatus } from "../lib/orderNotifications.js";
import { broadcastOrderUpdate } from "../lib/orderTracking.js";
import { stripe } from "../lib/stripe.js";
import { priceOrder, normalizeRequestedItems } from "../lib/pricing.js";

const router: IRouter = Router();

// Attaches the server-derived live-tracking fields (driver position fraction +
// ETA) to an order so the client can render the driver without any local timer.
// Both values are computed from createdAt, so they resume correctly after the
// tracking screen is closed and reopened, or after a server restart.
function withTracking<
  T extends { status: string; statusManual?: boolean; createdAt: Date | string },
>(order: T): T & { driverProgress: number; etaMinutes: number } {
  const delivered = order.status === "delivered";
  // Manually-controlled orders derive their tracking from the staff-set status
  // (not elapsed time) so the customer's view matches real-world progress.
  if (order.statusManual) {
    return {
      ...order,
      driverProgress: delivered ? 1 : progressForStatus(order.status),
      etaMinutes: delivered ? 0 : etaForStatus(order.status),
    };
  }
  const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
  return {
    ...order,
    driverProgress: delivered ? 1 : deriveDriverProgress(createdAt),
    etaMinutes: delivered ? 0 : deriveEtaMinutes(createdAt),
  };
}

const ORDER_COLUMNS = {
  id: ordersTable.id,
  userId: ordersTable.userId,
  restaurantId: ordersTable.restaurantId,
  restaurantName: restaurantsTable.name,
  feastWindowId: ordersTable.feastWindowId,
  deliveryType: ordersTable.deliveryType,
  deliveryAddress: ordersTable.deliveryAddress,
  deliveryLat: ordersTable.deliveryLat,
  deliveryLng: ordersTable.deliveryLng,
  items: ordersTable.items,
  subtotal: ordersTable.subtotal,
  status: ordersTable.status,
  statusManual: ordersTable.statusManual,
  rating: ordersTable.rating,
  ratingComment: ordersTable.ratingComment,
  ratedAt: ordersTable.ratedAt,
  createdAt: ordersTable.createdAt,
  updatedAt: ordersTable.updatedAt,
} as const;

// Maps an order status to a partial update that stamps the wall-clock time the
// order entered that status. Used everywhere status changes (manual or derived)
// so future restaurant/driver/admin dashboards have real stage history. Returns
// an empty object for statuses without a dedicated timestamp column.
function statusTimestampPatch(status: string): Partial<typeof ordersTable.$inferInsert> {
  const now = new Date();
  switch (status) {
    case "confirmed":
      return { confirmedAt: now };
    case "preparing":
      return { preparingAt: now };
    case "driver_assigned":
      return { driverAssignedAt: now };
    case "on_the_way":
      return { onTheWayAt: now };
    case "delivered":
      return { deliveredAt: now };
    case "cancelled":
      return { cancelledAt: now };
    default:
      return {};
  }
}

// Advances a stored order to the time-appropriate status (and persists it) so
// status stays correct without background timers — robust across restarts.
async function syncOrderStatus<
  T extends { id: number; status: string; statusManual?: boolean; createdAt: Date | string },
>(order: T): Promise<T> {
  // Manual updates always win — never let the time-based simulation overwrite a
  // status that restaurant/driver staff set by hand.
  if (order.statusManual) return order;
  if (isTerminal(order.status)) return order;
  const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
  const derived = deriveOrderStatus(createdAt);
  if (derived === order.status) return order;
  await db
    .update(ordersTable)
    .set({ status: derived, updatedAt: new Date(), ...statusTimestampPatch(derived) })
    .where(eq(ordersTable.id, order.id));
  return { ...order, status: derived };
}

router.post("/orders", requireAuth, validateBody(placeOrderSchema), async (req: AuthRequest, res) => {
  try {
    // NOTE: `subtotal` and each item's `price`/`name` from the client are
    // deliberately ignored — they are recomputed/looked up server-side below so
    // a tampered or stale client total can never be trusted.
    const { restaurantId, feastWindowId, deliveryType, deliveryAddress, deliveryLat, deliveryLng, items, paymentIntentId } = req.body as {
      restaurantId: string;
      feastWindowId?: string | null;
      deliveryType: "delivery" | "pickup";
      deliveryAddress?: string | null;
      deliveryLat?: number | null;
      deliveryLng?: number | null;
      items: unknown[];
      paymentIntentId: string;
    };

    if (!restaurantId || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "restaurantId and a non-empty items array are required" });
      return;
    }
    if (!paymentIntentId) {
      res.status(400).json({ error: "A confirmed payment is required to place an order" });
      return;
    }

    // Normalize the requested line items down to the only fields the server
    // trusts from the client (menu item, quantity, note); price/name are dropped.
    const normalized = normalizeRequestedItems(items);
    if (!normalized.ok) {
      res.status(400).json({ error: normalized.error });
      return;
    }

    const effectiveDeliveryType = (deliveryType ?? "delivery") as "delivery" | "pickup";

    // Price the cart through the single shared pricing function — the exact same
    // logic the PaymentIntent was opened with — so the amount we verify against
    // the payment can never diverge from what we charged.
    const priceResult = await priceOrder({
      restaurantId,
      deliveryType: effectiveDeliveryType,
      feastWindowId: feastWindowId ?? null,
      items: normalized.items,
    });
    if (!priceResult.ok) {
      res.status(priceResult.status).json({ error: priceResult.error });
      return;
    }
    const { lineItems, subtotalCents, totalCents } = priceResult.priced;
    const subtotal = (subtotalCents / 100).toFixed(2);
    const total = (totalCents / 100).toFixed(2);

    // Re-verify the payment server-side before creating the order. An order can
    // only be placed for a payment that (a) actually succeeded, (b) charged the
    // amount we just recomputed, and (c) belongs to this user. The card brand/
    // last4 are read from the confirmed charge — never trusted from the client.
    let paymentIntent: import("stripe").Stripe.PaymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge.payment_method_details"],
      });
    } catch {
      res.status(400).json({ error: "Payment could not be verified" });
      return;
    }

    if (paymentIntent.metadata?.userId !== String(req.user!.userId)) {
      res.status(403).json({ error: "This payment does not belong to you" });
      return;
    }
    if (paymentIntent.status !== "succeeded") {
      res.status(400).json({ error: "Payment has not been completed" });
      return;
    }
    if (paymentIntent.amount !== totalCents || paymentIntent.currency !== "usd") {
      res.status(400).json({ error: "Payment amount does not match the order total" });
      return;
    }

    const charge =
      typeof paymentIntent.latest_charge === "object" && paymentIntent.latest_charge
        ? paymentIntent.latest_charge
        : null;
    const cardDetails = charge?.payment_method_details?.card ?? null;
    const cardBrand = cardDetails?.brand ?? null;
    const cardLast4 = cardDetails?.last4 ?? null;

    // Persist the delivery address (and pin coords when present) so the tracking
    // map can derive the real destination later, including from order history.
    // Only meaningful for delivery orders; ignore for pickup.
    const isDelivery = (deliveryType ?? "delivery") === "delivery";
    const trimmedAddress =
      isDelivery && typeof deliveryAddress === "string" && deliveryAddress.trim()
        ? deliveryAddress.trim()
        : null;
    const lat =
      isDelivery && typeof deliveryLat === "number" && Number.isFinite(deliveryLat)
        ? String(deliveryLat)
        : null;
    const lng =
      isDelivery && typeof deliveryLng === "number" && Number.isFinite(deliveryLng)
        ? String(deliveryLng)
        : null;

    // Write the order and its immutable line-item snapshots atomically so an
    // order can never exist without its snapshot rows (or vice versa). The
    // `items` jsonb mirrors the same server-built snapshot for the existing
    // read model, while order_items is the normalized record of truth. The unique
    // constraint on payment_intent_id makes a payment reusable for exactly one
    // order — a replayed paymentIntentId raises a unique violation (handled below).
    let order: typeof ordersTable.$inferSelect | undefined;
    try {
      order = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(ordersTable)
          .values({
            userId: req.user!.userId,
            restaurantId,
            feastWindowId: feastWindowId ?? null,
            deliveryType: deliveryType ?? "delivery",
            deliveryAddress: trimmedAddress,
            deliveryLat: lat,
            deliveryLng: lng,
            items: lineItems,
            subtotal,
            total,
            paymentIntentId,
            paymentStatus: paymentIntent.status,
            cardBrand,
            cardLast4,
            status: "confirmed",
            ...statusTimestampPatch("confirmed"),
          })
          .returning();

        await tx.insert(orderItemsTable).values(
          lineItems.map((li) => ({
            orderId: created!.id,
            menuItemId: li.menuItemId,
            name: li.name,
            unitPrice: li.price.toFixed(2),
            quantity: li.quantity,
            specialInstructions: li.specialInstructions ?? null,
          })),
        );

        return created;
      });
    } catch (err) {
      // A unique violation means this payment was already used for an order — the
      // first order stands, so do NOT refund; just reject the duplicate. Drizzle
      // wraps the driver error, so the Postgres "23505" code can be on the error
      // itself or on its `cause`.
      const pgCode =
        (err as { code?: string })?.code ?? ((err as { cause?: { code?: string } })?.cause?.code);
      if (pgCode === "23505") {
        res.status(409).json({ error: "This payment has already been used for an order" });
        return;
      }
      // Any other failure happened AFTER a successful charge — refund the customer
      // so we never keep money without delivering an order.
      try {
        await stripe.refunds.create({ payment_intent: paymentIntentId });
      } catch (refundErr) {
        req.log.error({ err: refundErr, paymentIntentId }, "refund after failed order insert failed");
      }
      throw err;
    }

    // Schedule the customer's status-change push notifications (preparing →
    // delivered) up front so they fire even if the app is closed before then.
    if (order) scheduleOrderById(order.id);

    res.status(201).json(order);
  } catch (err) {
    req.log.error({ err }, "place order error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/orders/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select(ORDER_COLUMNS)
      .from(ordersTable)
      .leftJoin(restaurantsTable, eq(ordersTable.restaurantId, restaurantsTable.id))
      .where(eq(ordersTable.userId, req.user!.userId))
      .orderBy(ordersTable.createdAt);
    const synced = await Promise.all(rows.map((row) => syncOrderStatus(row)));
    res.json(synced.map(withTracking));
  } catch (err) {
    req.log.error({ err }, "list orders error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Columns returned to the staff dashboard. Includes the customer's name/phone
// (joined from users) so staff know who each order is for — fields the customer
// order endpoints never expose.
const STAFF_ORDER_COLUMNS = {
  ...ORDER_COLUMNS,
  customerName: usersTable.fullName,
  customerPhone: usersTable.phone,
} as const;

// Staff dashboard: list every active (not delivered/cancelled) order across all
// restaurants so staff can see incoming orders and advance them. Orders are
// status-synced first (time-based ones catch up to their derived status) and
// returned oldest-first so the longest-waiting order is at the top. Requires a
// staff-role token. Declared before "/orders/:id" so the literal path wins over
// the parameterized route (otherwise ":id" captures "active").
router.get("/orders/active", requireStaff, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select(STAFF_ORDER_COLUMNS)
      .from(ordersTable)
      .leftJoin(restaurantsTable, eq(ordersTable.restaurantId, restaurantsTable.id))
      .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
      .where(notInArray(ordersTable.status, ["delivered", "cancelled"]))
      .orderBy(ordersTable.createdAt);
    const synced = await Promise.all(rows.map((row) => syncOrderStatus(row)));
    // A time-based sync can push an order to "delivered"; drop those so the list
    // only shows orders that still need staff attention.
    const active = synced.filter(
      (o: (typeof synced)[number]) => o.status !== "delivered" && o.status !== "cancelled",
    );
    res.json(active.map(withTracking));
  } catch (err) {
    req.log.error({ err }, "list active orders error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/orders/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(orderId)) {
      res.status(400).json({ error: "Invalid order id" });
      return;
    }

    const [row] = await db
      .select(ORDER_COLUMNS)
      .from(ordersTable)
      .leftJoin(restaurantsTable, eq(ordersTable.restaurantId, restaurantsTable.id))
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (row.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Record that the owner's tracking screen polled this order. This presence
    // signal lets the notification scheduler suppress a push while the app is
    // open (the in-app local notification handles it) and only push when the
    // app is backgrounded/closed.
    await db
      .update(ordersTable)
      .set({ lastPolledAt: new Date() })
      .where(eq(ordersTable.id, orderId));

    const synced = await syncOrderStatus(row);
    res.json(withTracking(synced));
  } catch (err) {
    req.log.error({ err }, "get order error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Persists a manual status change made by restaurant/driver staff: marks the
// order as manually controlled (so the time-based simulation stops overriding
// it), pushes the customer notification for the new status, and returns the
// order with refreshed live-tracking fields.
async function applyManualStatus(orderId: number, status: string) {
  const [updated] = await db
    .update(ordersTable)
    .set({ status, statusManual: true, updatedAt: new Date(), ...statusTimestampPatch(status) })
    .where(eq(ordersTable.id, orderId))
    .returning();
  if (updated) {
    notifyManualStatus(orderId, status);
    // Push the new position/ETA to the customer's open tracking screen right
    // away instead of waiting for the next periodic tick or poll.
    broadcastOrderUpdate(updated);
  }
  return updated;
}

// Manual status update from restaurant/driver staff to an explicit status.
// Manual updates take precedence over the elapsed-time simulation. Restricted to
// staff/driver/admin roles — a customer's token gets a 403 here.
router.patch(
  "/orders/:id/status",
  requireAuth,
  requireRole("restaurant_staff", "driver", "admin"),
  validateBody(updateOrderStatusSchema),
  async (req: AuthRequest, res) => {
  try {
    const { status } = req.body as { status: string };
    const orderId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(orderId)) {
      res.status(400).json({ error: "Invalid order id" });
      return;
    }

    if (typeof status !== "string" || !isValidStatus(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const updated = await applyManualStatus(orderId, status);
    res.json(withTracking(updated!));
  } catch (err) {
    req.log.error({ err }, "update order status error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Convenience staff/driver action: advance the order to the next status in the
// flow (confirmed → preparing → driver_assigned → on_the_way → delivered).
// Restricted to staff/driver/admin roles — a customer's token gets a 403 here.
router.post(
  "/orders/:id/advance",
  requireAuth,
  requireRole("restaurant_staff", "driver", "admin"),
  async (req: AuthRequest, res) => {
  try {
    const orderId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(orderId)) {
      res.status(400).json({ error: "Invalid order id" });
      return;
    }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const next = nextStatus(order.status);
    if (!next) {
      res.status(409).json({ error: "Order is already at the final status" });
      return;
    }

    const updated = await applyManualStatus(orderId, next);
    res.json(withTracking(updated!));
  } catch (err) {
    req.log.error({ err }, "advance order status error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Recomputes a restaurant's displayed rating from its real, rated orders so the
// list/detail screens reflect actual customer feedback instead of static seed
// values. The average is derived by aggregate query (not incremental math), so
// it stays correct even when a customer changes a rating they already left. If a
// restaurant has no rated orders, its `rating`/`numRatings` are reset to 0 so it
// falls back gracefully rather than keeping a stale value.
async function recomputeRestaurantRating(restaurantId: string) {
  const [agg] = await db
    .select({
      avg: sql<string | null>`avg(${ordersTable.rating})`,
      count: sql<number>`count(${ordersTable.rating})::int`,
    })
    .from(ordersTable)
    .where(and(eq(ordersTable.restaurantId, restaurantId), isNotNull(ordersTable.rating)));

  const numRatings = agg?.count ?? 0;
  // numeric(3,1) column: round the average to one decimal place; "0" when none.
  const rating = numRatings > 0 && agg?.avg != null ? Number(agg.avg).toFixed(1) : "0";

  await db
    .update(restaurantsTable)
    .set({ rating, numRatings })
    .where(eq(restaurantsTable.id, restaurantId));
}

router.post("/orders/:id/rating", requireAuth, validateBody(rateOrderSchema), async (req: AuthRequest, res) => {
  try {
    const orderId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(orderId)) {
      res.status(400).json({ error: "Invalid order id" });
      return;
    }

    const { rating, comment } = req.body as { rating?: number; comment?: string };
    const ratingValue = Number(rating);
    if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      res.status(400).json({ error: "rating must be an integer between 1 and 5" });
      return;
    }

    const trimmedComment =
      typeof comment === "string" && comment.trim().length > 0 ? comment.trim() : null;

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (order.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Rating policy: an order can only be rated once it has actually been
    // delivered. Time-based orders may have "earned" the delivered status by
    // elapsed time without it being persisted yet, so sync first and check the
    // up-to-date status. Anything not delivered is rejected with a clear 409.
    const synced = await syncOrderStatus(order);
    if (synced.status !== "delivered") {
      res.status(409).json({ error: "You can only rate an order after it has been delivered" });
      return;
    }

    // An order carries exactly one rating. Re-rating is allowed but is always an
    // explicit edit of that single rating (the row is updated in place, never
    // duplicated), so one diner can never stack multiple votes onto a restaurant
    // — the aggregate recompute below still counts this order once. A repeat
    // submit of an identical value is therefore harmlessly idempotent.
    const isEdit = order.rating != null;

    const [updated] = await db
      .update(ordersTable)
      .set({
        rating: ratingValue,
        ratingComment: trimmedComment,
        ratedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, orderId))
      .returning();

    // Roll this rating into the restaurant's displayed average so the list and
    // detail screens show real, trustworthy feedback rather than seed values.
    await recomputeRestaurantRating(order.restaurantId);

    res.status(isEdit ? 200 : 201).json(updated);
  } catch (err) {
    req.log.error({ err }, "rate order error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

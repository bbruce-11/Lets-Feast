import { Router, type IRouter } from "express";
import Stripe from "stripe";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { stripe } from "../lib/stripe.js";
import { priceOrder, normalizeRequestedItems } from "../lib/pricing.js";
import {
  createIntentSchema,
  confirmPaymentSchema,
  attachPaymentMethodSchema,
} from "../lib/schemas.js";

const router: IRouter = Router();

// Returns the user's Stripe customer id, creating (and persisting) one lazily on
// first use. A per-user customer is what lets saved cards and default-payment-
// method selection work across sessions.
async function ensureStripeCustomer(userId: number): Promise<string> {
  const [user] = await db
    .select({
      stripeCustomerId: usersTable.stripeCustomerId,
      email: usersTable.email,
      fullName: usersTable.fullName,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) throw new Error("User not found");
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.fullName ?? undefined,
    metadata: { userId: String(userId) },
  });
  await db
    .update(usersTable)
    .set({ stripeCustomerId: customer.id })
    .where(eq(usersTable.id, userId));
  return customer.id;
}

// Shapes a Stripe PaymentMethod into the small, safe view the client needs. Only
// brand/last4/expiry — never anything that could reconstruct a card number.
function toSafeMethod(pm: Stripe.PaymentMethod, defaultId: string | null) {
  return {
    id: pm.id,
    brand: pm.card?.brand ?? "card",
    last4: pm.card?.last4 ?? "----",
    expMonth: pm.card?.exp_month ?? null,
    expYear: pm.card?.exp_year ?? null,
    isDefault: pm.id === defaultId,
  };
}

// Opens a PaymentIntent for the server-computed total of the given cart. The
// amount is priced server-side (priceOrder) so the charge can never be a client
// value. The intent carries the owner's id in metadata so order placement can
// confirm the payment belongs to the same user.
router.post(
  "/payments/create-intent",
  requireAuth,
  validateBody(createIntentSchema),
  async (req: AuthRequest, res) => {
    try {
      const { restaurantId, feastWindowId, deliveryType, items } = req.body as {
        restaurantId: string;
        feastWindowId?: string | null;
        deliveryType?: "delivery" | "pickup";
        items: unknown[];
      };

      const normalized = normalizeRequestedItems(items);
      if (!normalized.ok) {
        res.status(400).json({ error: normalized.error });
        return;
      }

      const result = await priceOrder({
        restaurantId,
        deliveryType: deliveryType ?? "delivery",
        feastWindowId: feastWindowId ?? null,
        items: normalized.items,
      });
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      const customerId = await ensureStripeCustomer(req.user!.userId);

      const intent = await stripe.paymentIntents.create({
        amount: result.priced.totalCents,
        currency: "usd",
        customer: customerId,
        // No redirect-based methods — this is a card-only, in-app flow.
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        metadata: {
          userId: String(req.user!.userId),
          restaurantId,
        },
      });

      res.json({
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        amountCents: result.priced.totalCents,
        breakdown: {
          subtotalCents: result.priced.subtotalCents,
          deliveryFeeCents: result.priced.deliveryFeeCents,
          serviceFeeCents: result.priced.serviceFeeCents,
          discountCents: result.priced.discountCents,
          totalCents: result.priced.totalCents,
        },
      });
    } catch (err) {
      req.log.error({ err }, "create payment intent error");
      res.status(500).json({ error: "Could not start payment" });
    }
  },
);

// Confirms a PaymentIntent with the chosen card. The card is referenced by a
// Stripe PaymentMethod id (a saved pm_... or a predefined test token) — the raw
// card number never reaches this server. A declined card returns a 402 with a
// clear message and does NOT place an order.
router.post(
  "/payments/confirm",
  requireAuth,
  validateBody(confirmPaymentSchema),
  async (req: AuthRequest, res) => {
    try {
      const { paymentIntentId, paymentMethod, savePaymentMethod } = req.body as {
        paymentIntentId: string;
        paymentMethod: string;
        savePaymentMethod?: boolean;
      };

      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      // Only the user who opened the intent may confirm it.
      if (intent.metadata?.userId !== String(req.user!.userId)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      try {
        const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
          payment_method: paymentMethod,
          // Saving attaches the card to the customer for future checkouts.
          ...(savePaymentMethod ? { setup_future_usage: "off_session" } : {}),
        });
        res.json({ status: confirmed.status });
      } catch (err) {
        // A declined / invalid card surfaces as a StripeCardError — translate it
        // into a clean 402 the client can show without leaking internals.
        if (err instanceof Stripe.errors.StripeCardError) {
          res.status(402).json({
            error: err.message || "Your card was declined.",
            code: err.code ?? "card_declined",
            declined: true,
          });
          return;
        }
        throw err;
      }
    } catch (err) {
      req.log.error({ err }, "confirm payment error");
      res.status(500).json({ error: "Could not confirm payment" });
    }
  },
);

// Lists the user's saved cards (safe fields only), flagging the default.
router.get("/payments/methods", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId))
      .limit(1);

    if (!user?.stripeCustomerId) {
      res.json([]);
      return;
    }

    const customer = await stripe.customers.retrieve(user.stripeCustomerId);
    const defaultId =
      customer && !customer.deleted
        ? ((customer.invoice_settings?.default_payment_method as string | null) ?? null)
        : null;

    const methods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });

    res.json(methods.data.map((pm) => toSafeMethod(pm, defaultId)));
  } catch (err) {
    req.log.error({ err }, "list payment methods error");
    res.status(500).json({ error: "Could not load payment methods" });
  }
});

// Saves a card to the user's Stripe customer. The card is provided as a Stripe
// PaymentMethod token (e.g. a test token) — no raw card data. The first saved
// card becomes the default automatically.
router.post(
  "/payments/methods",
  requireAuth,
  validateBody(attachPaymentMethodSchema),
  async (req: AuthRequest, res) => {
    try {
      const { paymentMethod } = req.body as { paymentMethod: string };
      const customerId = await ensureStripeCustomer(req.user!.userId);

      const attached = await stripe.paymentMethods.attach(paymentMethod, {
        customer: customerId,
      });

      // Make it the default if the customer had no cards before this one.
      const existing = await stripe.paymentMethods.list({ customer: customerId, type: "card" });
      let defaultId: string | null = null;
      if (existing.data.length === 1) {
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: attached.id },
        });
        defaultId = attached.id;
      } else {
        const customer = await stripe.customers.retrieve(customerId);
        defaultId =
          customer && !customer.deleted
            ? ((customer.invoice_settings?.default_payment_method as string | null) ?? null)
            : null;
      }

      res.status(201).json(toSafeMethod(attached, defaultId));
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError) {
        res.status(400).json({ error: err.message || "Could not save card" });
        return;
      }
      req.log.error({ err }, "attach payment method error");
      res.status(500).json({ error: "Could not save card" });
    }
  },
);

// Verifies a PaymentMethod belongs to the requesting user's customer. Prevents a
// user from mutating someone else's saved card by id.
async function ownsMethod(userId: number, methodId: string): Promise<string | null> {
  const [user] = await db
    .select({ stripeCustomerId: usersTable.stripeCustomerId })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user?.stripeCustomerId) return null;
  const pm = await stripe.paymentMethods.retrieve(methodId);
  if (pm.customer !== user.stripeCustomerId) return null;
  return user.stripeCustomerId;
}

// Makes a saved card the customer's default payment method.
router.post(
  "/payments/methods/:id/default",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const methodId = String(req.params.id);
      const customerId = await ownsMethod(req.user!.userId, methodId);
      if (!customerId) {
        res.status(404).json({ error: "Payment method not found" });
        return;
      }
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: methodId },
      });
      res.json({ id: methodId, isDefault: true });
    } catch (err) {
      req.log.error({ err }, "set default payment method error");
      res.status(500).json({ error: "Could not set default card" });
    }
  },
);

// Removes a saved card from the user's Stripe customer.
router.delete("/payments/methods/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const methodId = String(req.params.id);
    const customerId = await ownsMethod(req.user!.userId, methodId);
    if (!customerId) {
      res.status(404).json({ error: "Payment method not found" });
      return;
    }
    await stripe.paymentMethods.detach(methodId);
    res.json({ id: methodId, deleted: true });
  } catch (err) {
    req.log.error({ err }, "delete payment method error");
    res.status(500).json({ error: "Could not remove card" });
  }
});

export default router;

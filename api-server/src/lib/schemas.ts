import { z } from "zod/v4";

// Centralized request-body schemas for every write endpoint. These validate the
// shape, types, and length caps of incoming data at the API boundary so the
// route handlers can trust `req.body`. They intentionally accept the fields a
// well-formed client already sends (e.g. orders still include client `name`/
// `price`/`subtotal`, which the server ignores) so valid clients are unaffected,
// while malformed/oversized input is rejected with a 400 before any DB access.

// Length caps for free-text fields. Generous enough never to reject legitimate
// input, tight enough to reject abusive payloads.
const NAME_MAX = 200;
const EMAIL_MAX = 320;
const PASSWORD_MAX = 200;
const PHONE_MAX = 40;
const ZIP_MAX = 20;
const ID_MAX = 100;
const ADDRESS_MAX = 500;
const NOTE_MAX = 500;
const COMMENT_MAX = 1000;

// --- Auth ---

export const signupSchema = z.object({
  fullName: z.string().trim().min(1).max(NAME_MAX),
  email: z.string().trim().min(1).max(EMAIL_MAX),
  password: z.string().min(1).max(PASSWORD_MAX),
  phone: z.string().max(PHONE_MAX).optional(),
  zipCode: z.string().max(ZIP_MAX).optional(),
  referralCode: z.string().max(ID_MAX).nullable().optional(),
});

export const signinSchema = z.object({
  email: z.string().trim().min(1).max(EMAIL_MAX),
  password: z.string().min(1).max(PASSWORD_MAX),
});

export const updateMeSchema = z.object({
  fullName: z.string().trim().min(1).max(NAME_MAX).optional(),
  phone: z.string().max(PHONE_MAX).optional(),
  zipCode: z.string().max(ZIP_MAX).optional(),
  // Sanitized further by the route (accepts legacy strings or { label, lat, lng }
  // objects); here we only bound the array so an abusive payload is rejected.
  savedAddresses: z.array(z.unknown()).max(50).optional(),
  // Free-form per-user preferences blob stored as jsonb; not introspected here.
  preferences: z.unknown().optional(),
});

// --- Orders ---

export const placeOrderSchema = z.object({
  restaurantId: z.string().min(1).max(ID_MAX),
  feastWindowId: z.string().max(ID_MAX).nullable().optional(),
  deliveryType: z.enum(["delivery", "pickup"]).optional(),
  deliveryAddress: z.string().max(ADDRESS_MAX).nullable().optional(),
  deliveryLat: z.number().nullable().optional(),
  deliveryLng: z.number().nullable().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1).max(ID_MAX),
        // name/price are accepted (clients send them) but ignored server-side —
        // prices are looked up from the DB. Bounded so they can't be abused.
        name: z.string().max(NAME_MAX).optional(),
        price: z.number().optional(),
        quantity: z.number().int().positive().max(999),
        specialInstructions: z.string().max(NOTE_MAX).nullable().optional(),
      }),
    )
    .min(1)
    .max(100),
  // Accepted for backward compatibility but ignored — the server recomputes it.
  subtotal: z.number().optional(),
  // The succeeded Stripe (test-mode) PaymentIntent that paid for this order. The
  // route re-verifies it server-side (status, amount, owner, unused) before the
  // order is created — an order can never be placed without a real payment.
  paymentIntentId: z.string().min(1).max(255),
});

// --- Payments (Stripe test mode) ---

// The cart fields needed to price an order and open a PaymentIntent. Same shape
// the order endpoint accepts (client name/price are bounded but ignored).
const paymentItemsSchema = z
  .array(
    z.object({
      menuItemId: z.string().min(1).max(ID_MAX),
      name: z.string().max(NAME_MAX).optional(),
      price: z.number().optional(),
      quantity: z.number().int().positive().max(999),
      specialInstructions: z.string().max(NOTE_MAX).nullable().optional(),
    }),
  )
  .min(1)
  .max(100);

export const createIntentSchema = z.object({
  restaurantId: z.string().min(1).max(ID_MAX),
  feastWindowId: z.string().max(ID_MAX).nullable().optional(),
  deliveryType: z.enum(["delivery", "pickup"]).optional(),
  items: paymentItemsSchema,
});

export const confirmPaymentSchema = z.object({
  paymentIntentId: z.string().min(1).max(255),
  // A Stripe PaymentMethod reference: either a saved card id (pm_...) or a
  // predefined test-mode token (e.g. pm_card_visa). Never a raw card number.
  paymentMethod: z.string().min(1).max(255),
  savePaymentMethod: z.boolean().optional(),
});

export const attachPaymentMethodSchema = z.object({
  paymentMethod: z.string().min(1).max(255),
});

export const updateOrderStatusSchema = z.object({
  status: z.string().min(1).max(50),
});

export const rateOrderSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(COMMENT_MAX).nullable().optional(),
});

// --- Push tokens ---

export const registerPushTokenSchema = z.object({
  token: z.string().min(1).max(500),
  platform: z.string().max(50).nullable().optional(),
});

export const unregisterPushTokenSchema = z.object({
  token: z.string().max(500).optional(),
});

import Stripe from "stripe";

// Single shared Stripe client built from the test-mode secret key. We talk to
// Stripe directly with the SDK (no Replit Stripe connector / catalog sync) because
// this app charges dynamic, server-computed amounts via PaymentIntents and keeps a
// per-user Stripe customer for saved cards — not a fixed product/price catalog.
const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error(
    "STRIPE_SECRET_KEY is not set — the payments endpoints cannot operate without it.",
  );
}

export const stripe = new Stripe(secretKey);

// Whether the configured key is a test-mode key. Used to keep this build honest:
// the checkout flow is test-mode only and should never run against a live key.
export const isTestMode = secretKey.startsWith("sk_test_");

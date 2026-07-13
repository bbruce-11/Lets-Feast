// Maps a Stripe test card number to its predefined test-mode PaymentMethod token.
// The app runs in Expo Go + web (no native build), so it cannot use Stripe's
// native card SDK. Instead the raw number NEVER leaves the device — we look up the
// matching predefined test token and send only that token to the server, which
// creates and confirms a real test-mode PaymentIntent. The card brand/last4 shown
// on the order come back from the confirmed charge, not from anything typed here.

export interface TestCard {
  digits: string;
  token: string;
  label: string;
  declines: boolean;
}

export const TEST_CARDS: TestCard[] = [
  { digits: "4242424242424242", token: "pm_card_visa", label: "Visa — succeeds", declines: false },
  { digits: "5555555555554444", token: "pm_card_mastercard", label: "Mastercard — succeeds", declines: false },
  { digits: "378282246310005", token: "pm_card_amex", label: "Amex — succeeds", declines: false },
  { digits: "6011111111111117", token: "pm_card_discover", label: "Discover — succeeds", declines: false },
  { digits: "4000000000000002", token: "pm_card_chargeDeclined", label: "Visa — declined", declines: true },
  {
    digits: "4000000000009995",
    token: "pm_card_chargeDeclinedInsufficientFunds",
    label: "Visa — insufficient funds",
    declines: true,
  },
];

// Resolves the test PaymentMethod token for an entered card number. Unknown but
// well-formed numbers fall back to a successful Visa so the demo stays usable; the
// decline numbers above let testers exercise the failure path on purpose.
export function tokenForCardNumber(number: string): string {
  const digits = number.replace(/\D/g, "");
  const match = TEST_CARDS.find((c) => c.digits === digits);
  return match?.token ?? "pm_card_visa";
}

// A short, human label for a saved/confirmed card brand (Stripe returns lowercase
// brand slugs like "visa"/"amex").
export function prettyBrand(brand: string): string {
  const map: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "Amex",
    discover: "Discover",
    diners: "Diners Club",
    jcb: "JCB",
    unionpay: "UnionPay",
  };
  return map[brand?.toLowerCase()] ?? (brand ? brand[0].toUpperCase() + brand.slice(1) : "Card");
}

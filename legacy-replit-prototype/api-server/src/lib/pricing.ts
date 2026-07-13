import { db } from "@workspace/db";
import { menuItemsTable, feastWindowsTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";

// Flat delivery fee (in cents) charged on delivery orders; pickup is free. Kept
// in cents so it composes cleanly with the integer-cents math below.
const DELIVERY_FEE_CENTS = 299;
// Service fee as a fraction of the subtotal (5%).
const SERVICE_FEE_RATE = 0.05;

export interface RequestedItem {
  menuItemId: string;
  quantity: number;
  specialInstructions: string | null;
}

export interface PricedLineItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
}

export interface PriceBreakdown {
  subtotalCents: number;
  deliveryFeeCents: number;
  serviceFeeCents: number;
  discountCents: number;
  totalCents: number;
}

export interface PricedOrder extends PriceBreakdown {
  lineItems: PricedLineItem[];
}

export type PriceResult =
  | { ok: true; priced: PricedOrder }
  | { ok: false; status: number; error: string };

export interface PriceInput {
  restaurantId: string;
  deliveryType: "delivery" | "pickup";
  feastWindowId?: string | null;
  items: RequestedItem[];
}

// THE single source of truth for what an order costs. Both the checkout payment
// intent and the order-placement endpoint price the cart through this function so
// the amount we charge and the amount we record can never diverge — and so a
// tampered or stale client total is never trusted. All money is computed in
// integer cents to avoid floating-point drift, then surfaced as cents.
export async function priceOrder(input: PriceInput): Promise<PriceResult> {
  const { restaurantId, deliveryType } = input;

  if (!input.items.length) {
    return { ok: false, status: 400, error: "Order must contain at least one item" };
  }

  // Look up the real price/name for every requested item, scoped to THIS
  // restaurant so an item from another restaurant can't be smuggled in.
  const ids = [...new Set(input.items.map((r) => r.menuItemId))];
  const menuRows = await db
    .select({ id: menuItemsTable.id, name: menuItemsTable.name, price: menuItemsTable.price })
    .from(menuItemsTable)
    .where(and(eq(menuItemsTable.restaurantId, restaurantId), inArray(menuItemsTable.id, ids)));
  const menuById = new Map(menuRows.map((m) => [m.id, m]));

  const missing = ids.filter((id) => !menuById.has(id));
  if (missing.length > 0) {
    return {
      ok: false,
      status: 400,
      error: `Unknown menu item(s) for this restaurant: ${missing.join(", ")}`,
    };
  }

  // Build trusted line-item snapshots from DB values and sum the subtotal in cents.
  let subtotalCents = 0;
  const lineItems: PricedLineItem[] = input.items.map((r) => {
    const menu = menuById.get(r.menuItemId)!;
    const unitPrice = Number(menu.price);
    subtotalCents += Math.round(unitPrice * 100) * r.quantity;
    return {
      menuItemId: r.menuItemId,
      name: menu.name,
      price: unitPrice,
      quantity: r.quantity,
      ...(r.specialInstructions ? { specialInstructions: r.specialInstructions } : {}),
    };
  });

  const deliveryFeeCents = deliveryType === "delivery" ? DELIVERY_FEE_CENTS : 0;
  const serviceFeeCents = Math.round(subtotalCents * SERVICE_FEE_RATE);

  // Feast-window discount (a dollar amount) is looked up server-side from the DB,
  // never taken from the client. Missing/expired window simply means no discount.
  let discountCents = 0;
  if (input.feastWindowId) {
    const [win] = await db
      .select({ discount: feastWindowsTable.discount })
      .from(feastWindowsTable)
      .where(eq(feastWindowsTable.id, input.feastWindowId))
      .limit(1);
    if (win?.discount != null) {
      discountCents = Math.round(Number(win.discount) * 100);
    }
  }

  // Total can never go below zero even if a discount exceeds the running total.
  const totalCents = Math.max(0, subtotalCents + deliveryFeeCents + serviceFeeCents - discountCents);

  return {
    ok: true,
    priced: { lineItems, subtotalCents, deliveryFeeCents, serviceFeeCents, discountCents, totalCents },
  };
}

// Normalizes the loosely-typed client `items` array down to the only fields the
// server trusts (which item, how many, any note). Returns an error message if any
// entry is malformed. price/name from the client are intentionally dropped.
export function normalizeRequestedItems(
  items: unknown[],
): { ok: true; items: RequestedItem[] } | { ok: false; error: string } {
  const out: RequestedItem[] = [];
  for (const raw of items) {
    const it = raw as { menuItemId?: unknown; quantity?: unknown; specialInstructions?: unknown };
    const menuItemId = typeof it.menuItemId === "string" ? it.menuItemId : "";
    const quantity = Number(it.quantity);
    if (!menuItemId || !Number.isInteger(quantity) || quantity <= 0) {
      return { ok: false, error: "Each item needs a valid menuItemId and a positive integer quantity" };
    }
    const specialInstructions =
      typeof it.specialInstructions === "string" && it.specialInstructions.trim()
        ? it.specialInstructions.trim()
        : null;
    out.push({ menuItemId, quantity, specialInstructions });
  }
  return { ok: true, items: out };
}

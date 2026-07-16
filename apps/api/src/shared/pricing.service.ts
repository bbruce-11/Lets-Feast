import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DELIVERY_FEE_CENTS = 299;
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

export interface PricedOrder {
  lineItems: PricedLineItem[];
  subtotalCents: number;
  deliveryFeeCents: number;
  serviceFeeCents: number;
  tipCents: number;
  discountCents: number;
  totalCents: number;
}

export type PriceResult =
  | { ok: true; priced: PricedOrder }
  | { ok: false; status: number; error: string };

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Single source of truth for cart pricing. Uses DB prices — never trusts client values. */
  async priceOrder(input: {
    restaurantId: string;
    deliveryType: 'delivery' | 'pickup';
    feastWindowId?: string | null;
    tipCents?: number;
    items: RequestedItem[];
  }): Promise<PriceResult> {
    const { restaurantId, deliveryType } = input;
    if (!input.items.length)
      return { ok: false, status: 400, error: 'Order must contain at least one item' };

    const tipCents = input.tipCents ?? 0;
    if (!Number.isInteger(tipCents) || tipCents < 0)
      return { ok: false, status: 400, error: 'tipCents must be a non-negative integer' };
    if (tipCents > 0 && deliveryType !== 'delivery')
      return { ok: false, status: 400, error: 'Tips are only applicable to delivery orders' };

    const ids = [...new Set(input.items.map((r) => r.menuItemId))];
    const menuRows = await this.prisma.menuItem.findMany({
      where: { restaurantId, id: { in: ids } },
      select: { id: true, name: true, price: true },
    });

    const menuById = new Map(menuRows.map((m) => [m.id, m]));
    const missing = ids.filter((id) => !menuById.has(id));
    if (missing.length > 0)
      return { ok: false, status: 400, error: `Unknown menu item(s) for this restaurant: ${missing.join(', ')}` };

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

    const deliveryFeeCents = deliveryType === 'delivery' ? DELIVERY_FEE_CENTS : 0;
    const serviceFeeCents = Math.round(subtotalCents * SERVICE_FEE_RATE);

    let discountCents = 0;
    if (input.feastWindowId) {
      const win = await this.prisma.feastWindow.findUnique({
        where: { id: input.feastWindowId },
        select: { discount: true },
      });
      if (win?.discount != null) discountCents = Math.round(Number(win.discount) * 100);
    }

    const totalCents = Math.max(
      0,
      subtotalCents + deliveryFeeCents + serviceFeeCents + tipCents - discountCents,
    );

    return {
      ok: true,
      priced: { lineItems, subtotalCents, deliveryFeeCents, serviceFeeCents, tipCents, discountCents, totalCents },
    };
  }

  /** Normalises the loosely-typed client items array — drops price/name, returns only trusted fields. */
  normalizeRequestedItems(
    items: unknown[],
  ): { ok: true; items: RequestedItem[] } | { ok: false; error: string } {
    const out: RequestedItem[] = [];
    for (const raw of items) {
      const it = raw as { menuItemId?: unknown; quantity?: unknown; specialInstructions?: unknown };
      const menuItemId = typeof it.menuItemId === 'string' ? it.menuItemId : '';
      const quantity = Number(it.quantity);
      if (!menuItemId || !Number.isInteger(quantity) || quantity <= 0)
        return { ok: false, error: 'Each item needs a valid menuItemId and a positive integer quantity' };
      const specialInstructions =
        typeof it.specialInstructions === 'string' && it.specialInstructions.trim()
          ? it.specialInstructions.trim()
          : null;
      out.push({ menuItemId, quantity, specialInstructions });
    }
    return { ok: true, items: out };
  }
}

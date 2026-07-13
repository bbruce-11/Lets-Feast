import { describe, it, expect } from 'vitest';
import { planReorder, applyReorderToCart } from './reorderPlan';
import type { CartItem } from '@/context/CartContext';
import type {
  ApiOrder,
  ApiOrderItem,
  ApiRestaurant,
  ApiMenuItem,
} from '@/lib/api';

function orderItem(overrides: Partial<ApiOrderItem> = {}): ApiOrderItem {
  return {
    menuItemId: 'm1',
    name: 'Pad Thai',
    price: 12,
    quantity: 1,
    ...overrides,
  };
}

function order(overrides: Partial<ApiOrder> = {}): ApiOrder {
  return {
    id: 1,
    userId: 1,
    restaurantId: 'r1',
    restaurantName: 'Pho House',
    deliveryType: 'delivery',
    items: [orderItem()],
    subtotal: '12.00',
    status: 'delivered',
    createdAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function apiRestaurant(overrides: Partial<ApiRestaurant> = {}): ApiRestaurant {
  return {
    id: 'r1',
    name: 'Pho House',
    cuisine: 'Thai',
    neighborhood: 'Downtown',
    rating: '4.5',
    numRatings: 100,
    distance: '1 mi',
    deliveryTime: '20 min',
    pickupTime: '10 min',
    isOpen: true,
    imageIndex: 0,
    bgColor: '#333333',
    allergyTags: [],
    dietaryTags: [],
    categories: [],
    ...overrides,
  };
}

function apiMenuItem(overrides: Partial<ApiMenuItem> = {}): ApiMenuItem {
  return {
    id: 'm1',
    restaurantId: 'r1',
    category: 'Mains',
    name: 'Pad Thai',
    description: 'Noodles',
    price: '12',
    allergyTags: [],
    dietaryTags: [],
    imageIndex: 0,
    ...overrides,
  };
}

function fulfilled<T>(value: T): PromiseSettledResult<T> {
  return { status: 'fulfilled', value };
}

function rejected<T>(reason = new Error('fetch failed')): PromiseSettledResult<T> {
  return { status: 'rejected', reason };
}

const restOk = fulfilled(apiRestaurant());

function cartItem(id: string, name: string, price: number, quantity: number): CartItem {
  return {
    menuItem: {
      id,
      restaurantId: 'r1',
      category: 'Mains',
      name,
      description: '',
      price,
      allergyTags: [],
      dietaryTags: [],
      imageIndex: 0,
    },
    quantity,
  };
}

describe('planReorder availability branches', () => {
  it('adds an item that is still on the live menu', () => {
    const ord = order({ items: [orderItem({ menuItemId: 'm1', name: 'Pad Thai', price: 12, quantity: 2 })] });
    const menu = fulfilled([apiMenuItem({ id: 'm1', name: 'Pad Thai', price: '12' })]);

    const plan = planReorder(ord, restOk, menu, null);

    expect(plan.result.addedCount).toBe(1);
    expect(plan.result.unavailable).toEqual([]);
    expect(plan.reorderItems).toHaveLength(1);
    expect(plan.reorderItems[0].menuItem.id).toBe('m1');
    expect(plan.reorderItems[0].quantity).toBe(2);
    // No notice fires when everything is present and unchanged.
    expect(plan.reorderNotice).toBeNull();
  });

  it('records a price change for an item whose live price differs', () => {
    const ord = order({ items: [orderItem({ menuItemId: 'm1', name: 'Pad Thai', price: 12 })] });
    const menu = fulfilled([apiMenuItem({ id: 'm1', name: 'Pad Thai', price: '15' })]);

    const plan = planReorder(ord, restOk, menu, null);

    expect(plan.result.addedCount).toBe(1);
    expect(plan.result.unavailable).toEqual([]);
    expect(plan.result.priceChanges).toEqual([
      { name: 'Pad Thai', oldPrice: 12, newPrice: 15 },
    ]);
    expect(plan.reorderItems[0].menuItem.price).toBe(15);
    expect(plan.reorderNotice).toEqual({
      unavailable: [],
      priceChanges: [{ name: 'Pad Thai', oldPrice: 12, newPrice: 15 }],
    });
  });

  it('skips an item missing from a loaded menu and lists it in unavailable', () => {
    const ord = order({
      items: [
        orderItem({ menuItemId: 'm1', name: 'Pad Thai', price: 12 }),
        orderItem({ menuItemId: 'gone', name: 'Mango Sticky Rice', price: 6 }),
      ],
    });
    // The live menu loads but no longer contains 'gone'.
    const menu = fulfilled([apiMenuItem({ id: 'm1', name: 'Pad Thai', price: '12' })]);

    const plan = planReorder(ord, restOk, menu, null);

    expect(plan.result.addedCount).toBe(1);
    expect(plan.reorderItems.map((i) => i.menuItem.id)).toEqual(['m1']);
    expect(plan.result.unavailable).toEqual(['Mango Sticky Rice']);
    expect(plan.reorderNotice).toEqual({
      unavailable: ['Mango Sticky Rice'],
      priceChanges: [],
    });
  });

  it('falls back to the order snapshot when the menu fetch fails (nothing flagged unavailable)', () => {
    const ord = order({
      items: [
        orderItem({ menuItemId: 'm1', name: 'Pad Thai', price: 12, quantity: 1 }),
        orderItem({ menuItemId: 'm2', name: 'Spring Rolls', price: 5, quantity: 3 }),
      ],
    });
    const menu = rejected<ApiMenuItem[]>();

    const plan = planReorder(ord, restOk, menu, null);

    // Every snapshot item is restored; availability is unknown, so none flagged.
    expect(plan.result.addedCount).toBe(2);
    expect(plan.result.unavailable).toEqual([]);
    expect(plan.result.priceChanges).toEqual([]);
    expect(plan.reorderItems.map((i) => i.menuItem.id)).toEqual(['m1', 'm2']);
    // Snapshot prices/quantities are preserved from the order.
    expect(plan.reorderItems[1].menuItem.price).toBe(5);
    expect(plan.reorderItems[1].quantity).toBe(3);
    expect(plan.reorderNotice).toBeNull();
  });

  it('uses a minimal restaurant snapshot when the restaurant fetch fails', () => {
    const ord = order({ restaurantId: 'r1', restaurantName: 'Pho House' });
    const menu = fulfilled([apiMenuItem({ id: 'm1', price: '12' })]);

    const plan = planReorder(ord, rejected<ApiRestaurant>(), menu, null);

    expect(plan.restaurant.id).toBe('r1');
    expect(plan.restaurant.name).toBe('Pho House');
  });
});

describe('planReorder merge vs replace decision', () => {
  it('flags a different restaurant for replacement', () => {
    const ord = order({ restaurantId: 'r2' });
    const menu = fulfilled([apiMenuItem({ id: 'm1', restaurantId: 'r2', price: '12' })]);
    const current = { id: 'r1' } as any;

    const plan = planReorder(ord, fulfilled(apiRestaurant({ id: 'r2' })), menu, current);

    expect(plan.differentRestaurant).toBe(true);
  });

  it('does not flag a different restaurant when the cart is empty (no current restaurant)', () => {
    const ord = order({ restaurantId: 'r1' });
    const menu = fulfilled([apiMenuItem({ id: 'm1', price: '12' })]);

    const plan = planReorder(ord, restOk, menu, null);

    expect(plan.differentRestaurant).toBe(false);
  });

  it('does not flag a different restaurant for the same restaurant', () => {
    const ord = order({ restaurantId: 'r1' });
    const menu = fulfilled([apiMenuItem({ id: 'm1', price: '12' })]);
    const current = { id: 'r1' } as any;

    const plan = planReorder(ord, restOk, menu, current);

    expect(plan.differentRestaurant).toBe(false);
  });
});

describe('applyReorderToCart', () => {
  it('replaces the cart outright for a different restaurant', () => {
    const prev = [cartItem('a', 'Old Item', 8, 2)];
    const reorderItems = [cartItem('m1', 'Pad Thai', 12, 1)];

    const result = applyReorderToCart(prev, reorderItems, true);

    expect(result).toBe(reorderItems);
    expect(result.map((i) => i.menuItem.id)).toEqual(['m1']);
  });

  it('merges into the existing cart for the same restaurant, stacking quantities', () => {
    const prev = [cartItem('m1', 'Pad Thai', 12, 1), cartItem('m2', 'Spring Rolls', 5, 1)];
    const reorderItems = [cartItem('m1', 'Pad Thai', 12, 2), cartItem('m3', 'Tom Yum', 9, 1)];

    const result = applyReorderToCart(prev, reorderItems, false);

    // m1 stacks (1 + 2), m2 untouched, m3 appended.
    expect(result.map((i) => [i.menuItem.id, i.quantity])).toEqual([
      ['m1', 3],
      ['m2', 1],
      ['m3', 1],
    ]);
  });

  it('does not mutate the previous cart array when merging', () => {
    const prev = [cartItem('m1', 'Pad Thai', 12, 1)];
    const reorderItems = [cartItem('m1', 'Pad Thai', 12, 2)];

    applyReorderToCart(prev, reorderItems, false);

    // The original cart item is left at its original quantity.
    expect(prev[0].quantity).toBe(1);
  });
});

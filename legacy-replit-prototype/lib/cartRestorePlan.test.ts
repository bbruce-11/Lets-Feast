import { describe, it, expect } from 'vitest';
import { planCartRestore, isCheckoutBlocked, dismissCartNoticeState } from './cartRestorePlan';
import type { CartItem, CartNotice } from '@/context/CartContext';
import type { ApiRestaurant, ApiMenuItem } from '@/lib/api';
import type { Restaurant } from '@/data/mockData';

// ---------------------------------------------------------------------------
// Minimal builder helpers — keep fixtures local so tests read top-to-bottom
// ---------------------------------------------------------------------------

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

function cartItem(
  id: string,
  name: string,
  price: number,
  quantity = 1,
): CartItem {
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

function savedRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: 'r1',
    name: 'Pho House',
    cuisine: 'Thai',
    neighborhood: 'Downtown',
    rating: 4.5,
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

function fulfilled<T>(value: T): PromiseSettledResult<T> {
  return { status: 'fulfilled', value };
}

function rejected<T>(reason = new Error('fetch failed')): PromiseSettledResult<T> {
  return { status: 'rejected', reason };
}

const restOpen = fulfilled(apiRestaurant({ isOpen: true }));
const restClosed = fulfilled(apiRestaurant({ isOpen: false }));

// ---------------------------------------------------------------------------
// Restaurant-closed branch
// ---------------------------------------------------------------------------

describe('planCartRestore — restaurant now closed', () => {
  it('sets restaurantClosed=true and returns a cartNotice', () => {
    const saved = savedRestaurant();
    const items = [cartItem('m1', 'Pad Thai', 12)];
    const menu = fulfilled([apiMenuItem({ id: 'm1', price: '12' })]);

    const plan = planCartRestore(saved, items, restClosed, menu);

    expect(plan.restaurantClosed).toBe(true);
    expect(plan.cartNotice).not.toBeNull();
    expect(plan.cartNotice?.restaurantClosed).toBe(true);
  });

  it('refreshes freshRestaurant even when the restaurant is now closed', () => {
    const saved = savedRestaurant({ isOpen: true });
    const items = [cartItem('m1', 'Pad Thai', 12)];
    const menu = fulfilled([apiMenuItem({ id: 'm1', price: '12' })]);

    const plan = planCartRestore(saved, items, restClosed, menu);

    expect(plan.freshRestaurant).not.toBeNull();
    expect(plan.freshRestaurant?.isOpen).toBe(false);
  });

  it('includes restaurantClosed in cartNotice even when no item changes', () => {
    const saved = savedRestaurant();
    const items = [cartItem('m1', 'Pad Thai', 12)];
    const menu = fulfilled([apiMenuItem({ id: 'm1', price: '12' })]);

    const plan = planCartRestore(saved, items, restClosed, menu);

    expect(plan.cartNotice).toEqual({
      restaurantClosed: true,
      unavailable: [],
      priceChanges: [],
    });
  });
});

// ---------------------------------------------------------------------------
// Item no longer on the menu
// ---------------------------------------------------------------------------

describe('planCartRestore — item gone from loaded menu', () => {
  it('drops the unavailable item from nextItems', () => {
    const saved = savedRestaurant();
    const items = [
      cartItem('m1', 'Pad Thai', 12),
      cartItem('gone', 'Mango Sticky Rice', 6),
    ];
    const menu = fulfilled([apiMenuItem({ id: 'm1', price: '12' })]);

    const plan = planCartRestore(saved, items, restOpen, menu);

    expect(plan.nextItems).toHaveLength(1);
    expect(plan.nextItems[0].menuItem.id).toBe('m1');
  });

  it('lists the gone item name in cartNotice.unavailable', () => {
    const saved = savedRestaurant();
    const items = [
      cartItem('m1', 'Pad Thai', 12),
      cartItem('gone', 'Mango Sticky Rice', 6),
    ];
    const menu = fulfilled([apiMenuItem({ id: 'm1', price: '12' })]);

    const plan = planCartRestore(saved, items, restOpen, menu);

    expect(plan.cartNotice?.unavailable).toEqual(['Mango Sticky Rice']);
  });

  it('returns null cartNotice when all items are still on the menu and nothing changed', () => {
    const saved = savedRestaurant();
    const items = [cartItem('m1', 'Pad Thai', 12)];
    const menu = fulfilled([apiMenuItem({ id: 'm1', price: '12' })]);

    const plan = planCartRestore(saved, items, restOpen, menu);

    expect(plan.cartNotice).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Price change
// ---------------------------------------------------------------------------

describe('planCartRestore — price change', () => {
  it('records the old and new price in cartNotice.priceChanges', () => {
    const saved = savedRestaurant();
    const items = [cartItem('m1', 'Pad Thai', 12)];
    const menu = fulfilled([apiMenuItem({ id: 'm1', name: 'Pad Thai', price: '15' })]);

    const plan = planCartRestore(saved, items, restOpen, menu);

    expect(plan.cartNotice?.priceChanges).toEqual([
      { name: 'Pad Thai', oldPrice: 12, newPrice: 15 },
    ]);
  });

  it('applies the live price to the item in nextItems', () => {
    const saved = savedRestaurant();
    const items = [cartItem('m1', 'Pad Thai', 12)];
    const menu = fulfilled([apiMenuItem({ id: 'm1', name: 'Pad Thai', price: '15' })]);

    const plan = planCartRestore(saved, items, restOpen, menu);

    expect(plan.nextItems[0].menuItem.price).toBe(15);
  });

  it('preserves the original quantity when the price changes', () => {
    const saved = savedRestaurant();
    const items = [cartItem('m1', 'Pad Thai', 12, 3)];
    const menu = fulfilled([apiMenuItem({ id: 'm1', name: 'Pad Thai', price: '14' })]);

    const plan = planCartRestore(saved, items, restOpen, menu);

    expect(plan.nextItems[0].quantity).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Menu fetch failed — saved items left untouched
// ---------------------------------------------------------------------------

describe('planCartRestore — menu fetch failed', () => {
  it('returns the same savedItems reference (no false unavailable flags)', () => {
    const saved = savedRestaurant();
    const items = [
      cartItem('m1', 'Pad Thai', 12),
      cartItem('m2', 'Spring Rolls', 5, 2),
    ];

    const plan = planCartRestore(saved, items, restOpen, rejected<ApiMenuItem[]>());

    expect(plan.nextItems).toBe(items);
    expect(plan.menuReconciled).toBe(false);
  });

  it('does not set unavailable when the menu fetch fails', () => {
    const saved = savedRestaurant();
    const items = [cartItem('m1', 'Pad Thai', 12)];

    const plan = planCartRestore(saved, items, restOpen, rejected<ApiMenuItem[]>());

    expect(plan.cartNotice).toBeNull();
  });

  it('still surfaces restaurantClosed even when the menu fetch fails', () => {
    const saved = savedRestaurant();
    const items = [cartItem('m1', 'Pad Thai', 12)];

    const plan = planCartRestore(saved, items, restClosed, rejected<ApiMenuItem[]>());

    expect(plan.restaurantClosed).toBe(true);
    expect(plan.cartNotice?.restaurantClosed).toBe(true);
    expect(plan.nextItems).toBe(items);
  });
});

// ---------------------------------------------------------------------------
// Restaurant fetch failed
// ---------------------------------------------------------------------------

describe('planCartRestore — restaurant fetch failed', () => {
  it('sets freshRestaurant to null and restaurantClosed to false', () => {
    const saved = savedRestaurant();
    const items = [cartItem('m1', 'Pad Thai', 12)];
    const menu = fulfilled([apiMenuItem({ id: 'm1', price: '12' })]);

    const plan = planCartRestore(saved, items, rejected<ApiRestaurant>(), menu);

    expect(plan.freshRestaurant).toBeNull();
    expect(plan.restaurantClosed).toBe(false);
  });

  it('still reconciles the menu when only the restaurant fetch fails', () => {
    const saved = savedRestaurant();
    const items = [
      cartItem('m1', 'Pad Thai', 12),
      cartItem('gone', 'Mango Sticky Rice', 6),
    ];
    const menu = fulfilled([apiMenuItem({ id: 'm1', price: '12' })]);

    const plan = planCartRestore(saved, items, rejected<ApiRestaurant>(), menu);

    expect(plan.nextItems).toHaveLength(1);
    expect(plan.cartNotice?.unavailable).toEqual(['Mango Sticky Rice']);
  });
});

// ---------------------------------------------------------------------------
// checkoutBlocked — blocked only when the restaurant is closed
// ---------------------------------------------------------------------------

describe('isCheckoutBlocked', () => {
  it('is false when there is no notice at all', () => {
    expect(isCheckoutBlocked(null)).toBe(false);
  });

  it('is true when the notice says the restaurant is closed', () => {
    const plan = planCartRestore(
      savedRestaurant(),
      [cartItem('m1', 'Pad Thai', 12)],
      restClosed,
      fulfilled([apiMenuItem({ id: 'm1', price: '12' })]),
    );
    expect(isCheckoutBlocked(plan.cartNotice)).toBe(true);
  });

  it('is false for a removed-item notice (informational only)', () => {
    const plan = planCartRestore(
      savedRestaurant(),
      [cartItem('gone', 'Mango Sticky Rice', 6)],
      restOpen,
      fulfilled([apiMenuItem({ id: 'm1', price: '12' })]),
    );
    expect(plan.cartNotice?.unavailable).toEqual(['Mango Sticky Rice']);
    expect(isCheckoutBlocked(plan.cartNotice)).toBe(false);
  });

  it('is false for a price-change notice (informational only)', () => {
    const plan = planCartRestore(
      savedRestaurant(),
      [cartItem('m1', 'Pad Thai', 12)],
      restOpen,
      fulfilled([apiMenuItem({ id: 'm1', name: 'Pad Thai', price: '15' })]),
    );
    expect(plan.cartNotice?.priceChanges).toHaveLength(1);
    expect(isCheckoutBlocked(plan.cartNotice)).toBe(false);
  });

  it('is false for a feast-window-expired notice', () => {
    const notice: CartNotice = {
      restaurantClosed: false,
      unavailable: [],
      priceChanges: [],
      feastWindowExpired: true,
    };
    expect(isCheckoutBlocked(notice)).toBe(false);
  });

  it('stays true when the menu fetch fails but the restaurant is closed', () => {
    const plan = planCartRestore(
      savedRestaurant(),
      [cartItem('m1', 'Pad Thai', 12)],
      restClosed,
      rejected<ApiMenuItem[]>(),
    );
    expect(isCheckoutBlocked(plan.cartNotice)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dismissCartNotice — informational parts clear, closed block persists
// ---------------------------------------------------------------------------

describe('dismissCartNoticeState', () => {
  it('clears a purely informational notice entirely', () => {
    const notice: CartNotice = {
      restaurantClosed: false,
      unavailable: ['Mango Sticky Rice'],
      priceChanges: [{ name: 'Pad Thai', oldPrice: 12, newPrice: 15 }],
    };
    expect(dismissCartNoticeState(notice)).toBeNull();
  });

  it('keeps the closed-restaurant block while dropping informational parts', () => {
    const notice: CartNotice = {
      restaurantClosed: true,
      unavailable: ['Mango Sticky Rice'],
      priceChanges: [{ name: 'Pad Thai', oldPrice: 12, newPrice: 15 }],
      feastWindowExpired: true,
    };
    const next = dismissCartNoticeState(notice);
    expect(next).toEqual({ restaurantClosed: true, unavailable: [], priceChanges: [] });
    // Checkout must remain blocked after dismissal.
    expect(isCheckoutBlocked(next)).toBe(true);
  });

  it('is a no-op on null', () => {
    expect(dismissCartNoticeState(null)).toBeNull();
  });

  it('stays blocked across repeated dismissals', () => {
    let notice: CartNotice | null = {
      restaurantClosed: true,
      unavailable: [],
      priceChanges: [],
    };
    notice = dismissCartNoticeState(notice);
    notice = dismissCartNoticeState(notice);
    expect(isCheckoutBlocked(notice)).toBe(true);
  });
});

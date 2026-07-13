import { Restaurant } from '@/data/mockData';
import type { ApiRestaurant, ApiMenuItem } from '@/lib/api';
import type { CartItem, CartNotice, PriceChange } from '@/context/CartContext';
import { adaptRestaurant, adaptMenuItem } from './reorderPlan';

export interface CartRestorePlan {
  /** Refreshed restaurant from the API, or null when the fetch failed. */
  freshRestaurant: Restaurant | null;
  /** True when the live restaurant data confirms it is now closed. */
  restaurantClosed: boolean;
  /**
   * Reconciled cart items.
   * – Unchanged reference (identical to savedItems) when the menu fetch failed;
   *   the caller should avoid calling setItems to prevent a spurious re-render.
   * – New array when the menu loaded: unavailable items are dropped and each
   *   remaining item is updated to the live MenuItem (capturing the live price).
   */
  nextItems: CartItem[];
  /** True when the menu fetch succeeded and nextItems was rebuilt. */
  menuReconciled: boolean;
  /** Notice to surface, or null when nothing requires the user's attention. */
  cartNotice: CartNotice | null;
}

/**
 * Checkout is blocked only while the restaurant is known to be closed.
 * Any other notice (removed items, price changes, expired deals) is
 * informational and must NOT block checkout.
 */
export function isCheckoutBlocked(notice: CartNotice | null): boolean {
  return notice?.restaurantClosed ?? false;
}

/**
 * State transition for dismissing the cart notice: informational parts clear,
 * but a closed-restaurant block stays in place so checkout remains disabled
 * until the user picks another spot.
 */
export function dismissCartNoticeState(prev: CartNotice | null): CartNotice | null {
  return prev && prev.restaurantClosed
    ? { restaurantClosed: true, unavailable: [], priceChanges: [] }
    : null;
}

/**
 * Pure core of the post-hydration cart reconciliation effect in CartContext.
 *
 * Given the saved restaurant + cart items and the settled results of
 * re-fetching both, decide what changed while the app was backgrounded:
 *
 *   - Restaurant now closed  → cartNotice.restaurantClosed = true
 *   - Item gone from menu    → dropped from nextItems, listed in cartNotice.unavailable
 *   - Price changed          → listed in cartNotice.priceChanges; live price applied
 *   - Menu fetch failed      → savedItems returned untouched; nothing flagged missing
 *
 * Side effects (setState calls) are left to the caller so this stays
 * testable in isolation.
 */
export function planCartRestore(
  savedRestaurant: Restaurant,
  savedItems: CartItem[],
  restResult: PromiseSettledResult<ApiRestaurant>,
  menuResult: PromiseSettledResult<ApiMenuItem[]>,
): CartRestorePlan {
  let freshRestaurant: Restaurant | null = null;
  let restaurantClosed = false;

  if (restResult.status === 'fulfilled') {
    freshRestaurant = adaptRestaurant(restResult.value);
    restaurantClosed = !freshRestaurant.isOpen;
  }

  // Only when the menu fetch succeeded can we judge item availability.
  // A failed fetch tells us nothing — leave the cart untouched rather than
  // wrongly flagging saved items as unavailable.
  if (menuResult.status !== 'fulfilled') {
    return {
      freshRestaurant,
      restaurantClosed,
      nextItems: savedItems,
      menuReconciled: false,
      cartNotice: restaurantClosed
        ? { restaurantClosed: true, unavailable: [], priceChanges: [] }
        : null,
    };
  }

  const menu = menuResult.value.map(adaptMenuItem);
  const menuById = new Map(menu.map((m) => [m.id, m]));

  const nextItems: CartItem[] = [];
  const unavailable: string[] = [];
  const priceChanges: PriceChange[] = [];

  for (const ci of savedItems) {
    const current = menuById.get(ci.menuItem.id);
    if (!current) {
      unavailable.push(ci.menuItem.name);
      continue;
    }
    if (current.price !== ci.menuItem.price) {
      priceChanges.push({
        name: current.name,
        oldPrice: ci.menuItem.price,
        newPrice: current.price,
      });
    }
    nextItems.push({ ...ci, menuItem: current });
  }

  const cartNotice: CartNotice | null =
    restaurantClosed || unavailable.length > 0 || priceChanges.length > 0
      ? { restaurantClosed, unavailable, priceChanges }
      : null;

  return {
    freshRestaurant,
    restaurantClosed,
    nextItems,
    menuReconciled: true,
    cartNotice,
  };
}

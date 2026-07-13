import { MenuItem, Restaurant } from '@/data/mockData';
import type {
  ApiOrder,
  ApiOrderItem,
  ApiRestaurant,
  ApiMenuItem,
} from '@/lib/api';
import type {
  CartItem,
  PriceChange,
  ReorderNotice,
  ReorderResult,
} from '@/context/CartContext';

export function adaptRestaurant(r: ApiRestaurant): Restaurant {
  return {
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    neighborhood: r.neighborhood,
    rating: parseFloat(r.rating),
    numRatings: r.numRatings,
    distance: r.distance,
    deliveryTime: r.deliveryTime,
    pickupTime: r.pickupTime,
    isOpen: r.isOpen,
    imageIndex: r.imageIndex,
    bgColor: r.bgColor,
    lat: r.lat != null ? parseFloat(r.lat) : undefined,
    lng: r.lng != null ? parseFloat(r.lng) : undefined,
    allergyTags: (r.allergyTags ?? []) as string[],
    dietaryTags: (r.dietaryTags ?? []) as string[],
    categories: (r.categories ?? []) as string[],
    feastWindowId: r.feastWindowId ?? undefined,
    memberDeal: r.memberDeal ?? undefined,
  };
}

export function adaptMenuItem(m: ApiMenuItem): MenuItem {
  return {
    id: m.id,
    restaurantId: m.restaurantId,
    category: m.category,
    name: m.name,
    description: m.description,
    price: parseFloat(m.price),
    allergyTags: (m.allergyTags ?? []) as string[],
    dietaryTags: (m.dietaryTags ?? []) as string[],
    imageIndex: m.imageIndex,
  };
}

export function minimalRestaurant(order: ApiOrder): Restaurant {
  return {
    id: order.restaurantId,
    name: order.restaurantName ?? 'Restaurant',
    cuisine: '',
    neighborhood: '',
    rating: 0,
    numRatings: 0,
    distance: '',
    deliveryTime: '',
    pickupTime: '',
    isOpen: true,
    imageIndex: 0,
    bgColor: '#333333',
    allergyTags: [],
    dietaryTags: [],
    categories: [],
  };
}

export function minimalMenuItem(item: ApiOrderItem, restaurantId: string): MenuItem {
  return {
    id: item.menuItemId,
    restaurantId,
    category: '',
    name: item.name,
    description: '',
    price: item.price,
    allergyTags: [],
    dietaryTags: [],
    imageIndex: 0,
  };
}

export interface ReorderPlan {
  /** The restaurant the cart should switch to (live data, or a snapshot fallback). */
  restaurant: Restaurant;
  /** True when the order is for a different restaurant than the current cart. */
  differentRestaurant: boolean;
  /** The items that should be added to the cart (already resolved to live menu data). */
  reorderItems: CartItem[];
  /** A notice to surface, or null when nothing changed. */
  reorderNotice: ReorderNotice | null;
  /** The result handed back to the caller of reorder(). */
  result: ReorderResult;
}

/**
 * Pure core of CartContext.reorder. Given an order and the settled results of the
 * live restaurant + menu fetches, decide what to add to the cart and what to warn
 * about. Three item branches:
 *   1. Item still on the live menu  -> added (price change recorded if it differs)
 *   2. Item gone from a loaded menu -> skipped and listed in `unavailable`
 *   3. Menu fetch failed (unknown)  -> fall back to the order snapshot, no warning
 * Side effects (setState) are intentionally left to the caller so this stays
 * testable in isolation.
 */
export function planReorder(
  order: ApiOrder,
  restResult: PromiseSettledResult<ApiRestaurant>,
  menuResult: PromiseSettledResult<ApiMenuItem[]>,
  currentRestaurant: Restaurant | null,
): ReorderPlan {
  const rest = restResult.status === 'fulfilled'
    ? adaptRestaurant(restResult.value)
    : minimalRestaurant(order);

  // Only when the live menu loads can we judge availability. If the fetch
  // failed we can't tell, so fall back to the order's own snapshot rather
  // than wrongly flagging everything as gone.
  const menuKnown = menuResult.status === 'fulfilled';
  const menu = menuKnown ? menuResult.value.map(adaptMenuItem) : [];
  const menuById = new Map(menu.map((m) => [m.id, m]));

  const reorderItems: CartItem[] = [];
  const unavailable: string[] = [];
  const priceChanges: PriceChange[] = [];

  for (const oi of order.items) {
    const current = menuById.get(oi.menuItemId);
    if (current) {
      if (current.price !== oi.price) {
        priceChanges.push({ name: current.name, oldPrice: oi.price, newPrice: current.price });
      }
      reorderItems.push({
        menuItem: current,
        quantity: oi.quantity,
        specialInstructions: oi.specialInstructions,
      });
    } else if (!menuKnown) {
      reorderItems.push({
        menuItem: minimalMenuItem(oi, order.restaurantId),
        quantity: oi.quantity,
        specialInstructions: oi.specialInstructions,
      });
    } else {
      // Menu loaded successfully and this item is gone: skip it and warn.
      unavailable.push(oi.name);
    }
  }

  const differentRestaurant = currentRestaurant != null && currentRestaurant.id !== rest.id;

  const reorderNotice: ReorderNotice | null =
    unavailable.length > 0 || priceChanges.length > 0 ? { unavailable, priceChanges } : null;

  return {
    restaurant: rest,
    differentRestaurant,
    reorderItems,
    reorderNotice,
    result: { addedCount: reorderItems.length, unavailable, priceChanges },
  };
}

/**
 * Pure cart-merge step for reorder. A different restaurant replaces the cart
 * outright; the same restaurant merges the reordered items into what's there,
 * stacking quantities on matching menu items.
 */
export function applyReorderToCart(
  prev: CartItem[],
  reorderItems: CartItem[],
  differentRestaurant: boolean,
): CartItem[] {
  if (differentRestaurant) return reorderItems;
  const merged = prev.map((i) => ({ ...i }));
  for (const ri of reorderItems) {
    const existing = merged.find((i) => i.menuItem.id === ri.menuItem.id);
    if (existing) {
      existing.quantity += ri.quantity;
    } else {
      merged.push(ri);
    }
  }
  return merged;
}

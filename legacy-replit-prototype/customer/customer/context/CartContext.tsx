import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { MenuItem, Restaurant } from '@/data/mockData';
import {
  ordersApi,
  feastWindowsApi,
  restaurantsApi,
  type ApiOrder,
  type ApiFeastWindow,
} from '@/lib/api';
import { useFeastWindowContext } from '@/context/FeastWindowContext';
import { adaptRestaurant, adaptMenuItem, planReorder, applyReorderToCart } from '@/lib/reorderPlan';

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  specialInstructions?: string;
}

export interface PriceChange {
  name: string;
  oldPrice: number;
  newPrice: number;
}

export interface ReorderNotice {
  unavailable: string[];
  priceChanges: PriceChange[];
}

export interface CartNotice {
  restaurantClosed: boolean;
  unavailable: string[];
  priceChanges: PriceChange[];
}

export interface ReorderResult {
  addedCount: number;
  unavailable: string[];
  priceChanges: PriceChange[];
}

interface CartContextType {
  restaurant: Restaurant | null;
  items: CartItem[];
  deliveryType: 'delivery' | 'pickup';
  feastWindowId: string | null;
  reorderNotice: ReorderNotice | null;
  cartNotice: CartNotice | null;
  checkoutBlocked: boolean;
  addItem: (restaurant: Restaurant, menuItem: MenuItem) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  joinFeastWindow: (feastWindowId: string) => Promise<ApiFeastWindow>;
  leaveFeastWindow: () => void;
  setDeliveryType: (type: 'delivery' | 'pickup') => void;
  placeOrder: (
    paymentIntentId: string,
    delivery?: { address?: string; lat?: number | null; lng?: number | null },
  ) => Promise<ApiOrder>;
  reorder: (order: ApiOrder) => Promise<ReorderResult>;
  dismissReorderNotice: () => void;
  dismissCartNotice: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = '@feast_cart';

interface PersistedCart {
  restaurant: Restaurant | null;
  items: CartItem[];
  deliveryType: 'delivery' | 'pickup';
  feastWindowId: string | null;
}

export function CartContextProvider({ children }: { children: React.ReactNode }) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [feastWindowId, setFeastWindowId] = useState<string | null>(null);
  const [reorderNotice, setReorderNotice] = useState<ReorderNotice | null>(null);
  const [cartNotice, setCartNotice] = useState<CartNotice | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const validatedRef = useRef(false);
  const { applyFeastWindowUpdate, markWindowJoined, feastWindows, isLoading } = useFeastWindowContext();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (active && raw) {
          const parsed = JSON.parse(raw) as Partial<PersistedCart>;
          if (parsed.restaurant) setRestaurant(parsed.restaurant);
          if (Array.isArray(parsed.items)) setItems(parsed.items);
          if (parsed.deliveryType === 'delivery' || parsed.deliveryType === 'pickup') {
            setDeliveryType(parsed.deliveryType);
          }
          if (typeof parsed.feastWindowId === 'string') setFeastWindowId(parsed.feastWindowId);
        }
      } catch (_) {
        // Ignore corrupt storage; fall back to an empty cart.
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedCart = { restaurant, items, deliveryType, feastWindowId };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {
      // Persistence is best-effort; in-memory state is the source of truth.
    });
  }, [hydrated, restaurant, items, deliveryType, feastWindowId]);

  // Clear a stale feast window reference once windows have loaded and the
  // saved window is no longer available (it filled up or expired).
  useEffect(() => {
    if (!hydrated || isLoading || feastWindowId == null) return;
    const stillOpen = feastWindows.some((fw) => fw.id === feastWindowId);
    if (!stillOpen) setFeastWindowId(null);
  }, [hydrated, isLoading, feastWindowId, feastWindows]);

  // Once, after the cart is rehydrated, re-check the saved restaurant: it may
  // have closed or changed its menu/prices while the app was backgrounded. We
  // refresh the cart to the live data and surface a notice so the resumed order
  // is trustworthy (and block checkout when the restaurant is now closed).
  useEffect(() => {
    if (!hydrated || validatedRef.current) return;
    if (!restaurant || items.length === 0) return;
    validatedRef.current = true;

    const restId = restaurant.id;
    const savedItems = items;
    let active = true;

    (async () => {
      const [restResult, menuResult] = await Promise.allSettled([
        restaurantsApi.get(restId),
        restaurantsApi.menu(restId),
      ]);
      if (!active) return;

      let restaurantClosed = false;
      if (restResult.status === 'fulfilled') {
        const freshRest = adaptRestaurant(restResult.value);
        restaurantClosed = !freshRest.isOpen;
        // Refresh the stored snapshot so open/closed state and details are live.
        setRestaurant((prev) => (prev && prev.id === restId ? freshRest : prev));
      }

      const unavailable: string[] = [];
      const priceChanges: PriceChange[] = [];

      // Only reconcile the menu when the fetch succeeded; a failed lookup can't
      // tell us anything, so we leave the saved items untouched.
      if (menuResult.status === 'fulfilled') {
        const menu = menuResult.value.map(adaptMenuItem);
        const menuById = new Map(menu.map((m) => [m.id, m]));
        const next: CartItem[] = [];
        for (const ci of savedItems) {
          const current = menuById.get(ci.menuItem.id);
          if (!current) {
            unavailable.push(ci.menuItem.name);
            continue;
          }
          if (current.price !== ci.menuItem.price) {
            priceChanges.push({ name: current.name, oldPrice: ci.menuItem.price, newPrice: current.price });
          }
          next.push({ ...ci, menuItem: current });
        }
        setItems(next);
      }

      if (restaurantClosed || unavailable.length > 0 || priceChanges.length > 0) {
        setCartNotice({ restaurantClosed, unavailable, priceChanges });
      }
    })();

    return () => {
      active = false;
    };
  }, [hydrated, restaurant, items]);

  // Once a user manually touches a reordered item, the "price updated" hint for
  // that line has served its purpose, so drop it. When no hints remain (and
  // nothing is unavailable) the whole reorder notice clears.
  const clearReorderPriceChangeFor = (menuItemId: string) => {
    const target = items.find((i) => i.menuItem.id === menuItemId);
    if (!target) return;
    const name = target.menuItem.name;
    setReorderNotice((prev) => {
      if (!prev) return prev;
      const changes = prev.priceChanges.filter((c) => c.name !== name);
      if (changes.length === prev.priceChanges.length) return prev;
      if (changes.length === 0 && prev.unavailable.length === 0) return null;
      return { ...prev, priceChanges: changes };
    });
  };

  const addItem = (rest: Restaurant, menuItem: MenuItem) => {
    if (restaurant && restaurant.id !== rest.id) {
      setItems([{ menuItem, quantity: 1 }]);
      setRestaurant(rest);
      setFeastWindowId(null);
      // Switching to a different (freshly chosen) restaurant clears any stale
      // restore/reorder notices from the previous one.
      setCartNotice(null);
      setReorderNotice(null);
      return;
    }
    if (!restaurant) setRestaurant(rest);
    setItems((prev) => {
      const existing = prev.find((i) => i.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map((i) => i.menuItem.id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { menuItem, quantity: 1 }];
    });
    clearReorderPriceChangeFor(menuItem.id);
  };

  const removeItem = (menuItemId: string) => {
    clearReorderPriceChangeFor(menuItemId);
    setItems((prev) => prev.filter((i) => i.menuItem.id !== menuItemId));
  };

  const updateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }
    setItems((prev) => prev.map((i) => i.menuItem.id === menuItemId ? { ...i, quantity } : i));
    clearReorderPriceChangeFor(menuItemId);
  };

  const clearCart = () => {
    setItems([]);
    setRestaurant(null);
    setFeastWindowId(null);
    setReorderNotice(null);
    setCartNotice(null);
  };

  const dismissReorderNotice = () => setReorderNotice(null);

  // Dismissing clears the informational parts, but keeps the closed-restaurant
  // block in place so checkout stays disabled until the user picks another spot.
  const dismissCartNotice = () =>
    setCartNotice((prev) =>
      prev && prev.restaurantClosed
        ? { restaurantClosed: true, unavailable: [], priceChanges: [] }
        : null,
    );

  const checkoutBlocked = cartNotice?.restaurantClosed ?? false;

  const joinFeastWindow = async (id: string): Promise<ApiFeastWindow> => {
    const updated = await feastWindowsApi.join(id);
    applyFeastWindowUpdate(updated);
    markWindowJoined(id);
    setFeastWindowId(id);
    return updated;
  };

  const leaveFeastWindow = () => setFeastWindowId(null);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.menuItem.price * i.quantity, 0);

  // Hold rendering until the cart has been restored from storage so consumers
  // never observe an empty cart on the first render.
  if (!hydrated) return null;

  const placeOrder = async (
    paymentIntentId: string,
    delivery?: { address?: string; lat?: number | null; lng?: number | null },
  ): Promise<ApiOrder> => {
    if (!restaurant) throw new Error('No restaurant selected');
    if (items.length === 0) throw new Error('Cart is empty');
    if (!paymentIntentId) throw new Error('A confirmed payment is required');

    // Persist the delivery destination on the order (delivery only) so tracking
    // from order history can show the real drop-off, not a generic offset.
    const isDelivery = deliveryType === 'delivery';
    const address = isDelivery ? delivery?.address?.trim() || null : null;
    const lat = isDelivery && delivery?.lat != null ? delivery.lat : null;
    const lng = isDelivery && delivery?.lng != null ? delivery.lng : null;

    const order = await ordersApi.place({
      restaurantId: restaurant.id,
      feastWindowId: feastWindowId ?? null,
      deliveryType,
      deliveryAddress: address,
      deliveryLat: lat,
      deliveryLng: lng,
      items: items.map((i) => ({
        menuItemId: i.menuItem.id,
        name: i.menuItem.name,
        price: i.menuItem.price,
        quantity: i.quantity,
        specialInstructions: i.specialInstructions,
      })),
      subtotal,
      paymentIntentId,
    });

    clearCart();
    return order;
  };

  const reorder = async (order: ApiOrder): Promise<ReorderResult> => {
    const [restResult, menuResult] = await Promise.allSettled([
      restaurantsApi.get(order.restaurantId),
      restaurantsApi.menu(order.restaurantId),
    ]);

    const plan = planReorder(order, restResult, menuResult, restaurant);

    setRestaurant(plan.restaurant);
    if (plan.differentRestaurant) setFeastWindowId(null);
    setItems((prev) => applyReorderToCart(prev, plan.reorderItems, plan.differentRestaurant));
    setReorderNotice(plan.reorderNotice);

    return plan.result;
  };

  return (
    <CartContext.Provider value={{
      restaurant, items, deliveryType, feastWindowId, reorderNotice,
      cartNotice, checkoutBlocked,
      addItem, removeItem, updateQuantity, clearCart,
      joinFeastWindow, leaveFeastWindow, setDeliveryType,
      placeOrder, reorder, dismissReorderNotice, dismissCartNotice,
      totalItems, subtotal,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be within CartContextProvider');
  return ctx;
}

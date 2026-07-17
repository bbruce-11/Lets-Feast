import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ApiMenuItem } from '@/lib/api';

export interface CartItem {
  menuItem: ApiMenuItem;
  quantity: number;
}

interface CartContextValue {
  restaurantId: string | null;
  restaurantName: string | null;
  feastWindowId: string | null;
  items: CartItem[];
  totalItems: number;
  subtotalCents: number;
  addItem: (menuItem: ApiMenuItem, restaurantName: string) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  setFeastWindow: (feastWindowId: string | null) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartContextProvider({ children }: { children: ReactNode }) {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [feastWindowId, setFeastWindowId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

  function addItem(menuItem: ApiMenuItem, name: string) {
    // FEAST orders are single-restaurant (matches how /orders prices and
    // splits commission per restaurant) - switching restaurants clears
    // whatever was in the cart, same behavior as most delivery apps.
    if (restaurantId && restaurantId !== menuItem.restaurantId) {
      setItems([{ menuItem, quantity: 1 }]);
      setRestaurantId(menuItem.restaurantId);
      setRestaurantName(name);
      setFeastWindowId(null);
      return;
    }
    setRestaurantId(menuItem.restaurantId);
    setRestaurantName(name);
    setItems((current) => {
      const existing = current.find((i) => i.menuItem.id === menuItem.id);
      if (existing) {
        return current.map((i) =>
          i.menuItem.id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...current, { menuItem, quantity: 1 }];
    });
  }

  function removeItem(menuItemId: string) {
    setItems((current) => {
      const next = current.filter((i) => i.menuItem.id !== menuItemId);
      if (next.length === 0) {
        setRestaurantId(null);
        setRestaurantName(null);
        setFeastWindowId(null);
      }
      return next;
    });
  }

  function updateQuantity(menuItemId: string, quantity: number) {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }
    setItems((current) =>
      current.map((i) => (i.menuItem.id === menuItemId ? { ...i, quantity } : i)),
    );
  }

  function setFeastWindow(id: string | null) {
    setFeastWindowId(id);
  }

  function clear() {
    setItems([]);
    setRestaurantId(null);
    setRestaurantName(null);
    setFeastWindowId(null);
  }

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const subtotalCents = useMemo(
    () =>
      items.reduce(
        (sum, i) => sum + Math.round(Number.parseFloat(i.menuItem.price) * 100) * i.quantity,
        0,
      ),
    [items],
  );

  return (
    <CartContext.Provider
      value={{
        restaurantId,
        restaurantName,
        feastWindowId,
        items,
        totalItems,
        subtotalCents,
        addItem,
        removeItem,
        updateQuantity,
        setFeastWindow,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartContextProvider');
  return ctx;
}

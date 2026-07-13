import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { restaurantsApi, type ApiMenuItem } from '@/lib/api';
import { type MenuItem, menuItems as mockMenuItems } from '@/data/mockData';

const REFRESH_DEBOUNCE_MS = 30_000;

function adaptMenuItem(m: ApiMenuItem): MenuItem {
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

export function useMenuItems(restaurantId: string) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(
    mockMenuItems.filter((m) => m.restaurantId === restaurantId)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastFetchedAt = useRef(0);

  const refresh = useCallback(() => {
    if (!restaurantId) return Promise.resolve();
    lastFetchedAt.current = Date.now();
    return restaurantsApi.menu(restaurantId)
      .then((data) => {
        if (data.length > 0) setMenuItems(data.map(adaptMenuItem));
      })
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, [restaurantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!restaurantId) return;
    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState !== 'active') return;
      if (Date.now() - lastFetchedAt.current < REFRESH_DEBOUNCE_MS) return;
      refresh();
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [restaurantId, refresh]);

  return { menuItems, isLoading, error };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { restaurantsApi, type ApiRestaurant } from '@/lib/api';
import { type Restaurant, restaurants as mockRestaurants } from '@/data/mockData';
import { API_BASE } from '@/lib/api';

const REFRESH_DEBOUNCE_MS = 30_000;

function adaptRestaurant(r: ApiRestaurant): Restaurant {
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

export function getWsUrl(): string | null {
  const wsBase = API_BASE
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://');
  if (wsBase.startsWith('wss://') || wsBase.startsWith('ws://')) {
    return `${wsBase}/ws`;
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/api/ws`;
  }
  return null;
}

export function useRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>(mockRestaurants);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastFetchedAt = useRef(0);

  const refresh = useCallback(() => {
    lastFetchedAt.current = Date.now();
    return restaurantsApi.list()
      .then((data) => {
        if (data.length > 0) setRestaurants(data.map(adaptRestaurant));
      })
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState !== 'active') return;
      if (Date.now() - lastFetchedAt.current < REFRESH_DEBOUNCE_MS) return;
      refresh();
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [refresh]);

  return { restaurants, isLoading, error };
}

export function useRestaurant(id: string) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(
    mockRestaurants.find((r) => r.id === id) ?? null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastFetchedAt = useRef(0);

  const refresh = useCallback(() => {
    if (!id) return Promise.resolve();
    lastFetchedAt.current = Date.now();
    return restaurantsApi.get(id)
      .then((data) => setRestaurant(adaptRestaurant(data)))
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!id) return;
    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState !== 'active') return;
      if (Date.now() - lastFetchedAt.current < REFRESH_DEBOUNCE_MS) return;
      refresh();
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [id, refresh]);

  return { restaurant, isLoading, error };
}

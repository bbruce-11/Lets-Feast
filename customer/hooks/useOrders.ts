import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { ordersApi, type ApiOrder } from '@/lib/api';

const POLL_INTERVAL_MS = 30_000;

export function useOrders() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await ordersApi.mine();
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    intervalRef.current = setInterval(fetchOrders, POLL_INTERVAL_MS);

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        fetchOrders();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [fetchOrders]);

  return { orders, isLoading, error, refetch: fetchOrders };
}

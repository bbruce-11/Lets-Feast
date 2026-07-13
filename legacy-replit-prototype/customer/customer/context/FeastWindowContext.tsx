import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { feastWindowsApi, type ApiFeastWindow } from '@/lib/api';
import { type FeastWindow, feastWindows as mockFeastWindows } from '@/data/mockData';
import { getWsUrl } from '@/hooks/useRestaurants';
import { useApp } from '@/context/AppContext';

function adaptFeastWindow(fw: ApiFeastWindow): FeastWindow {
  return {
    id: fw.id,
    restaurantId: fw.restaurantId,
    deliveryStart: fw.deliveryStart,
    deliveryEnd: fw.deliveryEnd,
    spotsTotal: fw.spotsTotal,
    spotsFilled: fw.spotsFilled,
    discount: parseFloat(fw.discount),
    endTime: fw.endTime,
  };
}

export interface FeastWindowWsMessage {
  type: string;
  id?: string;
  data?: ApiFeastWindow;
  discount?: string | number;
  [key: string]: unknown;
}

type FeastWindowEventListener = (msg: FeastWindowWsMessage) => void;

interface FeastWindowContextType {
  feastWindows: FeastWindow[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  applyFeastWindowUpdate: (fw: ApiFeastWindow) => void;
  joinedWindowIds: string[];
  markWindowJoined: (id: string) => void;
  subscribe: (listener: FeastWindowEventListener) => () => void;
}

const FeastWindowContext = createContext<FeastWindowContextType | null>(null);

const REFRESH_DEBOUNCE_MS = 30_000;

export function FeastWindowProvider({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const [feastWindows, setFeastWindows] = useState<FeastWindow[]>(mockFeastWindows);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [joinedWindowIds, setJoinedWindowIds] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);
  const lastFetchedAt = useRef(0);
  const listenersRef = useRef<Set<FeastWindowEventListener>>(new Set());

  const subscribe = useCallback((listener: FeastWindowEventListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const refresh = useCallback(() => {
    lastFetchedAt.current = Date.now();
    return feastWindowsApi.list()
      .then((data) => {
        setFeastWindows(data.map(adaptFeastWindow));
      })
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, []);

  const applyFeastWindowUpdate = useCallback((updated: ApiFeastWindow) => {
    setFeastWindows((prev) => {
      const adapted = adaptFeastWindow(updated);
      const exists = prev.some((fw) => fw.id === adapted.id);
      return exists
        ? prev.map((fw) => (fw.id === adapted.id ? adapted : fw))
        : [...prev, adapted];
    });
  }, []);

  const markWindowJoined = useCallback((id: string) => {
    setJoinedWindowIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) {
      setJoinedWindowIds([]);
      return;
    }
    let cancelled = false;
    feastWindowsApi.myJoined()
      .then((ids) => {
        if (!cancelled) setJoinedWindowIds(ids);
      })
      .catch(() => {
        // Not authenticated or network error — leave joined state empty
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState !== 'active') return;
      if (Date.now() - lastFetchedAt.current < REFRESH_DEBOUNCE_MS) return;
      refresh();
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [refresh]);

  useEffect(() => {
    unmounted.current = false;

    function connect() {
      if (unmounted.current) return;
      const url = getWsUrl();
      if (!url) return;

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string);

            for (const listener of listenersRef.current) {
              try {
                listener(msg);
              } catch (err) {
                console.warn('[FeastWindowSync] Listener threw', err);
              }
            }

            if (msg.type === 'feast_window_update' && msg.data) {
              const updated: ApiFeastWindow = msg.data;
              setFeastWindows((prev) =>
                prev.map((fw) =>
                  fw.id === updated.id
                    ? adaptFeastWindow(updated)
                    : fw
                )
              );
            } else if (msg.type === 'feast_window_full' && msg.id) {
              setFeastWindows((prev) =>
                prev.map((fw) =>
                  fw.id === msg.id
                    ? { ...fw, spotsFilled: fw.spotsTotal }
                    : fw
                )
              );
            } else if (msg.type === 'feast_window_expired' && msg.id) {
              setFeastWindows((prev) =>
                prev.filter((fw) => fw.id !== msg.id)
              );
            }
          } catch (err) {
            console.warn('[FeastWindowSync] Failed to parse WS message', err);
          }
        };

        ws.onclose = () => {
          if (!unmounted.current) {
            reconnectTimer.current = setTimeout(connect, 3000);
          }
        };

        ws.onerror = (event) => {
          console.warn('[FeastWindowSync] WebSocket error', event);
          ws.close();
        };
      } catch (err) {
        console.warn('[FeastWindowSync] Failed to open WebSocket', err);
      }
    }

    connect();

    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return (
    <FeastWindowContext.Provider value={{ feastWindows, isLoading, error, refresh, applyFeastWindowUpdate, joinedWindowIds, markWindowJoined, subscribe }}>
      {children}
    </FeastWindowContext.Provider>
  );
}

export function useFeastWindowContext() {
  const ctx = useContext(FeastWindowContext);
  if (!ctx) throw new Error('useFeastWindowContext must be within FeastWindowProvider');
  return ctx;
}

export function useFeastWindows() {
  const { feastWindows, isLoading, error, joinedWindowIds } = useFeastWindowContext();
  return { feastWindows, isLoading, error, joinedWindowIds };
}

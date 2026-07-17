import { useEffect, useRef, useState } from 'react';
import { API_BASE } from './api';

export interface OrderTracking {
  id: number;
  status: string;
  driverProgress: number;
  etaMinutes: number;
}

const WS_STALE_MS = 4_000;
const POLL_FALLBACK_MS = 8_000;

/**
 * Live-tracks a single order. The server broadcasts every active order's
 * status to every connected client (no per-client subscription) - this hook
 * connects once and filters the stream down to the order it cares about.
 *
 * If no WS message for this order has arrived recently, falls back to
 * polling GET /orders/:id, matching the socket-drop fallback pattern noted
 * in the legacy prototype reference.
 */
export function useOrderTracking(
  orderId: number | null,
  initial: OrderTracking | null,
  fetchOrder: () => Promise<OrderTracking>,
) {
  const [tracking, setTracking] = useState<OrderTracking | null>(initial);
  const lastWsMessageAt = useRef<number>(0);

  useEffect(() => {
    if (!orderId) return;

    const wsUrl = API_BASE.replace(/^http/, 'ws') + '/ws';
    let socket: WebSocket | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    try {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg?.type === 'order_update' && msg.data?.id === orderId) {
            lastWsMessageAt.current = Date.now();
            if (isMounted) setTracking(msg.data);
          }
        } catch {
          // Ignore malformed messages rather than crash the tracking screen.
        }
      };
    } catch {
      // WebSocket construction can throw in some environments - poll fallback covers it.
    }

    pollInterval = setInterval(async () => {
      const staleForMs = Date.now() - lastWsMessageAt.current;
      if (lastWsMessageAt.current !== 0 && staleForMs < WS_STALE_MS) return;
      try {
        const fresh = await fetchOrder();
        if (isMounted) setTracking(fresh);
      } catch {
        // Transient network errors during polling aren't worth surfacing.
      }
    }, POLL_FALLBACK_MS);

    return () => {
      isMounted = false;
      socket?.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [orderId]);

  return tracking;
}

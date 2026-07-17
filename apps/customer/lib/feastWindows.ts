import { useEffect, useState } from 'react';
import { API_BASE } from './api';
import type { ApiFeastWindow } from './api';

/**
 * Keeps a list of feast windows live as other users join. The gateway
 * broadcasts `feast_window_update` with the full updated row on every join
 * (see FeastWindowsService.join in apps/api) - that's sufficient to derive
 * "is it full" and "is the discount unlocked" reactively client-side,
 * without needing to separately handle feast_window_full /
 * feast_window_discount_unlocked (those carry a subset of the same info).
 */
export function useFeastWindowsLive(initial: ApiFeastWindow[]): ApiFeastWindow[] {
  const [windows, setWindows] = useState(initial);

  useEffect(() => {
    setWindows(initial);
  }, [initial]);

  useEffect(() => {
    const wsUrl = API_BASE.replace(/^http/, 'ws') + '/ws';
    let socket: WebSocket | null = null;

    try {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg?.type === 'feast_window_update' && msg.data?.id) {
            const updated: ApiFeastWindow = msg.data;
            setWindows((current) => {
              if (!current.some((w) => w.id === updated.id)) return current;
              return current.map((w) => (w.id === updated.id ? updated : w));
            });
          }
        } catch {
          // Ignore malformed messages.
        }
      };
    } catch {
      // No live updates if the socket can't be constructed - list still
      // works from the initial fetch, just without real-time refresh.
    }

    return () => socket?.close();
  }, []);

  return windows;
}

export function discountUnlockThreshold(spotsTotal: number): number {
  return Math.ceil(spotsTotal / 2);
}

export function isDiscountUnlocked(win: Pick<ApiFeastWindow, 'spotsFilled' | 'spotsTotal'>): boolean {
  return win.spotsFilled >= discountUnlockThreshold(win.spotsTotal);
}

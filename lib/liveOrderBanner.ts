import type { ApiOrder } from '@/lib/api';

export const FINISHED_ORDER_STATUSES = new Set(['delivered', 'cancelled']);

export const STATUS_LABELS: Record<string, string> = {
  placed: 'Confirmed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  driver_assigned: 'Driver assigned',
  ready: 'On the way',
  on_the_way: 'On the way',
};

export interface WsOrderTracking {
  status: string;
  driverProgress: number;
  etaMinutes: number;
}

/** All non-terminal orders, sorted newest-first. */
export function getActiveOrders(orders: ApiOrder[]): ApiOrder[] {
  return orders
    .filter((order) => !FINISHED_ORDER_STATUSES.has(order.status))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export interface BannerDisplay {
  /** Human-readable status label shown in the banner. */
  statusLabel: string;
  /** Formatted ETA string e.g. "~5 min", or null when unknown. */
  eta: string | null;
  /** Progress fraction clamped to [0, 1]. */
  progress: number;
}

/**
 * Derive the banner's display values by merging a live WS push (if any) over
 * the polled order fields.  WS values win; polled values are the fallback.
 */
export function deriveBannerDisplay(
  order: ApiOrder,
  wsTracking?: WsOrderTracking | null,
): BannerDisplay {
  const liveStatus = wsTracking?.status ?? order.status;
  const liveProgress = wsTracking?.driverProgress ?? order.driverProgress ?? 0;
  const liveEta = wsTracking?.etaMinutes ?? order.etaMinutes;

  return {
    statusLabel: STATUS_LABELS[liveStatus] ?? 'In progress',
    eta: liveEta != null ? `~${Math.max(liveEta, 1)} min` : null,
    progress: Math.min(Math.max(liveProgress, 0), 1),
  };
}

/**
 * Build the router params object for the confirmation / tracking screen.
 * Only defined address/coordinate fields are included.
 */
export function buildTrackParams(order: ApiOrder): Record<string, string> {
  return {
    orderId: String(order.id),
    track: '1',
    ...(order.deliveryAddress ? { address: order.deliveryAddress } : {}),
    ...(order.deliveryLat != null ? { destLat: String(order.deliveryLat) } : {}),
    ...(order.deliveryLng != null ? { destLng: String(order.deliveryLng) } : {}),
  };
}

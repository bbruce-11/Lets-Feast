// Pure order-status functions — no external deps, safe to import anywhere.

export const ORDER_STATUS_FLOW = [
  'confirmed',
  'preparing',
  'driver_assigned',
  'on_the_way',
  'delivered',
] as const;

export type OrderStatus = (typeof ORDER_STATUS_FLOW)[number];

/** Elapsed-time offsets (ms from createdAt) at which each status becomes active. */
export const OFFSETS_MS: Record<OrderStatus, number> = {
  confirmed: 0,
  preparing: 6_000,
  driver_assigned: 14_000,
  on_the_way: 24_000,
  delivered: 48_000,
};

const NOMINAL_TOTAL_MINUTES = 40;

export function isTerminal(status: string): boolean {
  return status === 'delivered' || status === 'cancelled';
}

export function isValidStatus(status: string): status is OrderStatus {
  return (ORDER_STATUS_FLOW as readonly string[]).includes(status);
}

export function nextStatus(current: string): OrderStatus | null {
  const idx = (ORDER_STATUS_FLOW as readonly string[]).indexOf(current);
  if (idx < 0 || idx >= ORDER_STATUS_FLOW.length - 1) return null;
  return ORDER_STATUS_FLOW[idx + 1]!;
}

const STATUS_PROGRESS: Record<OrderStatus, number> = {
  confirmed: 0,
  preparing: 0,
  driver_assigned: 0,
  on_the_way: 0.5,
  delivered: 1,
};

const STATUS_ETA_MINUTES: Record<OrderStatus, number> = {
  confirmed: NOMINAL_TOTAL_MINUTES,
  preparing: 30,
  driver_assigned: 20,
  on_the_way: 10,
  delivered: 0,
};

export function progressForStatus(status: string): number {
  return isValidStatus(status) ? STATUS_PROGRESS[status] : 0;
}

export function etaForStatus(status: string): number {
  return isValidStatus(status) ? STATUS_ETA_MINUTES[status] : NOMINAL_TOTAL_MINUTES;
}

export function deriveOrderStatus(createdAt: Date, now: number = Date.now()): OrderStatus {
  const elapsed = now - createdAt.getTime();
  let current: OrderStatus = 'confirmed';
  for (const status of ORDER_STATUS_FLOW) {
    if (elapsed >= OFFSETS_MS[status]) current = status;
  }
  return current;
}

export function deriveDriverProgress(createdAt: Date, now: number = Date.now()): number {
  const elapsed = now - createdAt.getTime();
  const start = OFFSETS_MS.on_the_way;
  const end = OFFSETS_MS.delivered;
  if (elapsed <= start) return 0;
  if (elapsed >= end) return 1;
  return (elapsed - start) / (end - start);
}

export function deriveEtaMinutes(createdAt: Date, now: number = Date.now()): number {
  const elapsed = now - createdAt.getTime();
  const remaining = Math.max(0, Math.min(1, 1 - elapsed / OFFSETS_MS.delivered));
  return Math.ceil(remaining * NOMINAL_TOTAL_MINUTES);
}

/** Maps a status to the partial update that stamps its wall-clock timestamp column. */
export function statusTimestampPatch(status: string): Record<string, Date> {
  const now = new Date();
  switch (status) {
    case 'confirmed':       return { confirmedAt: now };
    case 'preparing':       return { preparingAt: now };
    case 'driver_assigned': return { driverAssignedAt: now };
    case 'on_the_way':      return { onTheWayAt: now };
    case 'delivered':       return { deliveredAt: now };
    case 'cancelled':       return { cancelledAt: now };
    default:                return {};
  }
}

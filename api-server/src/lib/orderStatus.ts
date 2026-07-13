export const ORDER_STATUS_FLOW = [
  "confirmed",
  "preparing",
  "driver_assigned",
  "on_the_way",
  "delivered",
] as const;

export type OrderStatus = (typeof ORDER_STATUS_FLOW)[number];

// Elapsed-time offsets (ms from createdAt) at which each status becomes active.
// Status is derived from elapsed time so it is fully deterministic and survives
// server restarts — no in-memory timers required. Exported so the notification
// scheduler can compute the absolute wall-clock time each status activates.
export const OFFSETS_MS: Record<OrderStatus, number> = {
  confirmed: 0,
  preparing: 6_000,
  driver_assigned: 14_000,
  on_the_way: 24_000,
  delivered: 48_000,
};

// Nominal real-world delivery duration used to present a human-readable ETA.
// The status simulation is time-compressed, so we scale elapsed progress onto
// this nominal window rather than surfacing the raw compressed seconds.
const NOMINAL_TOTAL_MINUTES = 40;

export function isTerminal(status: string): boolean {
  return status === "delivered" || status === "cancelled";
}

export function isValidStatus(status: string): status is OrderStatus {
  return (ORDER_STATUS_FLOW as readonly string[]).includes(status);
}

// Returns the status that follows `current` in the normal flow, or null if
// already at the final (delivered) status. Used by the staff/driver "advance to
// next status" endpoint so manual control mirrors the simulated progression.
export function nextStatus(current: string): OrderStatus | null {
  const idx = (ORDER_STATUS_FLOW as readonly string[]).indexOf(current);
  if (idx < 0 || idx >= ORDER_STATUS_FLOW.length - 1) return null;
  return ORDER_STATUS_FLOW[idx + 1]!;
}

// Driver route fraction (0..1) for a given status, used when an order is under
// manual control. With no elapsed-time signal to interpolate, each status maps
// to a representative point on the route: the driver only departs once the order
// is "on_the_way" and arrives at "delivered".
const STATUS_PROGRESS: Record<OrderStatus, number> = {
  confirmed: 0,
  preparing: 0,
  driver_assigned: 0,
  on_the_way: 0.5,
  delivered: 1,
};

// Representative ETA (whole minutes) for a given status under manual control,
// scaled onto the same nominal delivery window as the time-based simulation.
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
  let current: OrderStatus = "confirmed";
  for (const status of ORDER_STATUS_FLOW) {
    if (elapsed >= OFFSETS_MS[status]) {
      current = status;
    }
  }
  return current;
}

// Fraction (0..1) of the route the driver has covered. The driver departs the
// restaurant when the order goes "on_the_way" and arrives at "delivered", so we
// map elapsed time within that leg onto 0..1. Because it is derived from
// createdAt it is fully deterministic and resumes correctly across screen
// reloads and server restarts — no in-memory animation state required.
export function deriveDriverProgress(createdAt: Date, now: number = Date.now()): number {
  const elapsed = now - createdAt.getTime();
  const start = OFFSETS_MS.on_the_way;
  const end = OFFSETS_MS.delivered;
  if (elapsed <= start) return 0;
  if (elapsed >= end) return 1;
  return (elapsed - start) / (end - start);
}

// Estimated whole minutes remaining until the order is delivered. Decreases as
// time elapses so the ETA reflects real progress toward delivery.
export function deriveEtaMinutes(createdAt: Date, now: number = Date.now()): number {
  const elapsed = now - createdAt.getTime();
  const remainingFraction = Math.max(0, Math.min(1, 1 - elapsed / OFFSETS_MS.delivered));
  return Math.ceil(remainingFraction * NOMINAL_TOTAL_MINUTES);
}

// Order status flow shared with the API server (see api-server/src/lib/orderStatus.ts).
// confirmed → preparing → driver_assigned → on_the_way → delivered
export const ORDER_STATUS_FLOW = [
  "confirmed",
  "preparing",
  "driver_assigned",
  "on_the_way",
  "delivered",
] as const;

export type OrderStatus = (typeof ORDER_STATUS_FLOW)[number];

// Human-readable labels for each status, for display in the UI.
export const STATUS_LABELS: Record<OrderStatus, string> = {
  confirmed: "Confirmed",
  preparing: "Preparing",
  driver_assigned: "Driver Assigned",
  on_the_way: "On the Way",
  delivered: "Delivered",
};

// Returns the next status in the flow, or null if already at the final status.
export function nextStatus(current: string): OrderStatus | null {
  const idx = (ORDER_STATUS_FLOW as readonly string[]).indexOf(current);
  if (idx < 0 || idx >= ORDER_STATUS_FLOW.length - 1) return null;
  return ORDER_STATUS_FLOW[idx + 1]!;
}

export function statusLabel(status: string): string {
  return (STATUS_LABELS as Record<string, string>)[status] ?? status;
}

export interface StaffOrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
}

// Shape returned by GET /api/orders/active. Postgres numerics come back as
// strings (subtotal, deliveryLat/Lng) — parse before doing math on them.
export interface StaffOrder {
  id: number;
  userId: number;
  restaurantId: string;
  restaurantName?: string | null;
  feastWindowId?: string | null;
  deliveryType: string;
  deliveryAddress?: string | null;
  deliveryLat?: string | null;
  deliveryLng?: string | null;
  items: StaffOrderItem[];
  subtotal: string;
  status: string;
  statusManual?: boolean;
  customerName?: string | null;
  customerPhone?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  driverProgress?: number;
  etaMinutes?: number | null;
}

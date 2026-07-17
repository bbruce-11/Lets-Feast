export interface LineItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
}

export interface ActiveOrder {
  id: number;
  status: string;
  items: LineItem[];
  total: string;
  tipCents: number;
  deliveryType: string;
  deliveryAddress: string | null;
  restaurantName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  driverProgress: number;
  etaMinutes: number;
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const restaurantApi = {
  getActiveOrders: () => request<ActiveOrder[]>('/orders/active'),
  advanceOrder: (id: number) => request<ActiveOrder>(`/orders/${id}/advance`, { method: 'POST' }),
};

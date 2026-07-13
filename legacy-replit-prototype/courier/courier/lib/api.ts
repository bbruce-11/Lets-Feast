import { getToken } from "./auth";

declare const process: { env: Record<string, string | undefined> };

const API_BASE =
  process.env["EXPO_PUBLIC_DOMAIN"]
    ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
    : "http://localhost:8080/api";

export interface CourierOrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
}

export interface CourierOrder {
  id: number;
  restaurantId: string;
  restaurantName?: string | null;
  deliveryType: string;
  deliveryAddress?: string | null;
  items: CourierOrderItem[];
  subtotal: string;
  status: string;
  customerName?: string | null;
  customerPhone?: string | null;
  createdAt: string;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
      else if (body?.error) message = body.error;
    } catch {
      // Non-JSON body.
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const courierApi = {
  signin: (email: string, password: string) =>
    request<{ token: string }>("/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  getMyOrders: () => request<CourierOrder[]>("/courier/orders", {}, true),

  updateStatus: (id: number, status: string) =>
    request<CourierOrder>(
      `/courier/orders/${id}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      true
    ),
};

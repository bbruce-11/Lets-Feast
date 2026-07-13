import type { StaffOrder } from "./types";

// The API server is proxied at /api regardless of which artifact path the
// dashboard is served from, so absolute /api paths resolve correctly.
const API_BASE = "/api";

const TOKEN_KEY = "staff_token";

export function getStaffToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStaffToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore storage errors (e.g. private mode); the in-memory session still works.
  }
}

export function clearStaffToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore.
  }
}

export class ApiError extends Error {
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
  auth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = getStaffToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // Non-JSON error body; keep statusText.
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const staffApi = {
  // Exchange the staff passcode for a staff-role JWT.
  login: (passcode: string) =>
    request<{ token: string }>("/auth/staff/login", {
      method: "POST",
      body: JSON.stringify({ passcode }),
    }),

  // List all active (not delivered/cancelled) orders across restaurants.
  getActiveOrders: () => request<StaffOrder[]>("/orders/active", {}, true),

  // Advance an order to the next status in the flow.
  advanceOrder: (id: number) =>
    request<StaffOrder>(`/orders/${id}/advance`, { method: "POST" }, true),

  // Set an order to a specific status.
  setOrderStatus: (id: number, status: string) =>
    request<StaffOrder>(
      `/orders/${id}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      true,
    ),
};

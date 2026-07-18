import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@feast_courier_token';

export const API_BASE = `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080'}/api`;

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}, requiresAuth = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (requiresAuth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body?.message ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

// -----------------------------------------------------------------------
// Auth — real per-user accounts, same as admin (role=driver is assigned by
// manually promoting a signed-up user in the database; there's no self-serve
// "become a driver" signup flow).
// -----------------------------------------------------------------------

export interface ApiUser {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  role: string;
}

export function signIn(email: string, password: string) {
  return request<{ token: string; user: ApiUser }>('/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function getMe() {
  return request<ApiUser>('/auth/me', {}, true);
}

// -----------------------------------------------------------------------
// Courier orders
// -----------------------------------------------------------------------

export interface CourierOrder {
  id: number;
  status: string;
  total: string;
  tipCents: number;
  deliveryAddress: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  restaurantName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: string;
}

export function getAvailableOrders() {
  return request<CourierOrder[]>('/courier/orders/available', {}, true);
}

export function claimOrder(id: number) {
  return request<CourierOrder>(`/courier/orders/${id}/claim`, { method: 'POST' }, true);
}

export function getMyDeliveries() {
  return request<CourierOrder[]>('/courier/orders', {}, true);
}

export function updateDeliveryStatus(id: number, status: 'on_the_way' | 'delivered') {
  return request<CourierOrder>(
    `/courier/orders/${id}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
    true,
  );
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@feast_token';

// Set via EXPO_PUBLIC_API_URL at build/dev time. Falls back to localhost for
// local development against a locally-running apps/api.
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
// Auth
// -----------------------------------------------------------------------

export interface SavedAddress {
  label: string;
  lat?: number | null;
  lng?: number | null;
}

export interface ApiUser {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  zipCode: string;
  role: string;
  membershipStatus: 'free' | 'gold' | 'platinum';
  referralCode?: string | null;
  savedAddresses: Array<SavedAddress | string>;
  preferences?: unknown;
}

export interface SignUpPayload {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  zipCode?: string;
  referralCode?: string;
}

export function signUp(payload: SignUpPayload) {
  return request<{ token: string; user: ApiUser }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
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
// Restaurants — note: `rating` and `price` are Prisma Decimal fields on the
// server, which serialize to JSON as strings, not numbers. Parse at the call
// site rather than assuming a numeric type.
// -----------------------------------------------------------------------

export interface ApiRestaurant {
  id: string;
  name: string;
  cuisine: string;
  neighborhood: string;
  rating: string | null;
  numRatings: number;
  isOpen: boolean;
}

export interface ApiMenuItem {
  id: string;
  restaurantId: string;
  category: string;
  name: string;
  description: string;
  price: string;
  allergyTags: string[];
  dietaryTags: string[];
  imageIndex: number;
}

export function getRestaurants() {
  return request<ApiRestaurant[]>('/restaurants');
}

export function getRestaurant(id: string) {
  return request<ApiRestaurant>(`/restaurants/${id}`);
}

export function getRestaurantMenu(id: string) {
  return request<ApiMenuItem[]>(`/restaurants/${id}/menu`);
}

// -----------------------------------------------------------------------
// Payments — server-side confirmation pattern: the client tokenizes card
// details into a Stripe PaymentMethod (raw card data never touches our
// backend), then the server confirms the PaymentIntent using that ID.
// -----------------------------------------------------------------------

export interface RequestedItem {
  menuItemId: string;
  quantity: number;
}

export interface CreateIntentPayload {
  restaurantId: string;
  deliveryType: 'delivery' | 'pickup';
  items: RequestedItem[];
}

export interface CreateIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  amountCents: number;
  breakdown: {
    subtotalCents: number;
    deliveryFeeCents: number;
    serviceFeeCents: number;
    discountCents: number;
    totalCents: number;
  };
}

export function createPaymentIntent(payload: CreateIntentPayload) {
  return request<CreateIntentResult>('/payments/create-intent', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, true);
}

export function confirmPayment(paymentIntentId: string, paymentMethod: string) {
  return request<{ status: string }>('/payments/confirm', {
    method: 'POST',
    body: JSON.stringify({ paymentIntentId, paymentMethod }),
  }, true);
}

// -----------------------------------------------------------------------
// Orders
// -----------------------------------------------------------------------

export interface PlaceOrderPayload {
  restaurantId: string;
  deliveryType: 'delivery' | 'pickup';
  deliveryAddress?: string | null;
  items: RequestedItem[];
  paymentIntentId: string;
  tipCents?: number;
}

export interface ApiOrder {
  id: number;
  status: string;
  total: string;
  restaurantId: string;
  restaurantName: string | null;
  driverProgress: number;
  etaMinutes: number;
}

export function placeOrder(payload: PlaceOrderPayload) {
  return request<ApiOrder>('/orders', { method: 'POST', body: JSON.stringify(payload) }, true);
}

export function getOrder(id: number) {
  return request<ApiOrder>(`/orders/${id}`, {}, true);
}

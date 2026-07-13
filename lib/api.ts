import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@feast_token';

export const API_BASE = (() => {
  const replId = process.env.EXPO_PUBLIC_REPL_ID;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (replId && domain) {
    return `https://${domain}/api`;
  }
  return '/api';
})();

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  requiresAuth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (requiresAuth) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body?.error ?? `Request failed: ${res.status}`);
  }

  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

// A saved delivery address. lat/lng are the precise drop-off coordinates set via
// the map pin picker; they are absent on legacy text-only addresses.
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
  membershipStatus: 'free' | 'gold' | 'platinum';
  referralCode?: string | null;
  // The server normalizes to objects, but tolerate legacy strings defensively.
  savedAddresses: Array<SavedAddress | string>;
  preferences?: unknown;
}

export interface SignUpPayload {
  fullName: string;
  phone: string;
  email: string;
  zipCode: string;
  password: string;
  referralCode?: string;
}

export interface AuthResponse {
  token: string;
  user: ApiUser;
}

export const authApi = {
  signUp: (data: SignUpPayload) =>
    request<AuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),

  signIn: (email: string, password: string) =>
    request<AuthResponse>('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) }),

  me: () => request<ApiUser>('/auth/me', {}, true),

  updateMe: (updates: {
    fullName?: string;
    phone?: string;
    zipCode?: string;
    savedAddresses?: SavedAddress[];
    preferences?: unknown;
  }) =>
    request<ApiUser>('/auth/me', { method: 'PATCH', body: JSON.stringify(updates) }, true),
};

export interface ApiRestaurant {
  id: string;
  name: string;
  cuisine: string;
  neighborhood: string;
  rating: string;
  numRatings: number;
  distance: string;
  deliveryTime: string;
  pickupTime: string;
  isOpen: boolean;
  imageIndex: number;
  bgColor: string;
  lat?: string | null;
  lng?: string | null;
  allergyTags: string[];
  dietaryTags: string[];
  categories: string[];
  feastWindowId?: string | null;
  memberDeal?: string | null;
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

export interface ApiFeastWindow {
  id: string;
  restaurantId: string;
  deliveryStart: string;
  deliveryEnd: string;
  spotsTotal: number;
  spotsFilled: number;
  discount: string;
  endTime: number;
}

// A single written diner review surfaced on the restaurant page. Sourced from a
// real rated order; only orders with a written comment are returned. reviewerName
// is the privacy-safe display name (first name + last initial) built server-side.
export interface ApiRestaurantReview {
  id: number;
  rating: number;
  comment: string;
  ratedAt: string | null;
  reviewerName: string;
}

export const restaurantsApi = {
  list: () => request<ApiRestaurant[]>('/restaurants'),
  get: (id: string) => request<ApiRestaurant>(`/restaurants/${id}`),
  menu: (id: string) => request<ApiMenuItem[]>(`/restaurants/${id}/menu`),
  reviews: (id: string) => request<ApiRestaurantReview[]>(`/restaurants/${id}/reviews`),
};

export const feastWindowsApi = {
  list: () => request<ApiFeastWindow[]>('/feast-windows'),
  get: (id: string) => request<ApiFeastWindow>(`/feast-windows/${id}`),
  join: (id: string) =>
    request<ApiFeastWindow>(`/feast-windows/${id}/join`, { method: 'POST' }, true),
  myJoined: () => request<string[]>('/feast-windows/me/joined', {}, true),
};

export interface PlaceOrderPayload {
  restaurantId: string;
  feastWindowId?: string | null;
  deliveryType: 'delivery' | 'pickup';
  // The delivery address text entered at checkout, persisted on the order so the
  // tracking map can show/derive the real destination from order history.
  deliveryAddress?: string | null;
  // The precise drop-off pin coordinates from the selected saved address (absent
  // when a typed address has no saved pin).
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  items: Array<{
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    specialInstructions?: string;
  }>;
  subtotal: number;
  // The succeeded Stripe (test-mode) PaymentIntent that paid for this order. The
  // server re-verifies it before creating the order — there is no order without a
  // confirmed payment.
  paymentIntentId: string;
}

export interface ApiOrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
}

export interface ApiOrder {
  id: number;
  userId: number;
  restaurantId: string;
  restaurantName?: string | null;
  feastWindowId?: string | null;
  deliveryType: string;
  // Persisted delivery destination. lat/lng are Postgres numerics → strings;
  // parse before use. All null for pickup orders or legacy orders placed before
  // the address was persisted.
  deliveryAddress?: string | null;
  deliveryLat?: string | null;
  deliveryLng?: string | null;
  items: ApiOrderItem[];
  subtotal: string;
  status: string;
  // True when restaurant/driver staff set the status manually; the time-based
  // simulation no longer advances it.
  statusManual?: boolean;
  rating?: number | null;
  ratingComment?: string | null;
  ratedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  // Server-derived live tracking. driverProgress is the fraction (0..1) of the
  // route the driver has covered; etaMinutes is whole minutes until delivery.
  driverProgress?: number;
  etaMinutes?: number | null;
}

export const ordersApi = {
  place: (data: PlaceOrderPayload) =>
    request<ApiOrder>('/orders', { method: 'POST', body: JSON.stringify(data) }, true),

  mine: () => request<ApiOrder[]>('/orders/me', {}, true),

  get: (id: number) => request<ApiOrder>(`/orders/${id}`, {}, true),

  updateStatus: (id: number, status: string) =>
    request<ApiOrder>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, true),

  advanceStatus: (id: number) =>
    request<ApiOrder>(`/orders/${id}/advance`, { method: 'POST' }, true),

  rate: (id: number, rating: number, comment?: string) =>
    request<ApiOrder>(`/orders/${id}/rating`, { method: 'POST', body: JSON.stringify({ rating, comment }) }, true),
};

export const pushApi = {
  register: (token: string, platform?: string) =>
    request<null>('/push/tokens', { method: 'POST', body: JSON.stringify({ token, platform }) }, true),

  unregister: (token: string) =>
    request<null>('/push/tokens', { method: 'DELETE', body: JSON.stringify({ token }) }, true),
};

// --- Payments (Stripe test mode) ---

// The server-computed cost breakdown, all in integer cents.
export interface PaymentBreakdown {
  subtotalCents: number;
  deliveryFeeCents: number;
  serviceFeeCents: number;
  discountCents: number;
  totalCents: number;
}

export interface CreateIntentPayload {
  restaurantId: string;
  feastWindowId?: string | null;
  deliveryType: 'delivery' | 'pickup';
  items: Array<{ menuItemId: string; quantity: number; specialInstructions?: string }>;
}

export interface CreateIntentResponse {
  clientSecret: string | null;
  paymentIntentId: string;
  amountCents: number;
  breakdown: PaymentBreakdown;
}

// A saved card as exposed to the client — only the safe, non-sensitive fields.
export interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}

export const paymentsApi = {
  // Opens a PaymentIntent for the server-computed total of the given cart.
  createIntent: (data: CreateIntentPayload) =>
    request<CreateIntentResponse>('/payments/create-intent', { method: 'POST', body: JSON.stringify(data) }, true),

  // Confirms a PaymentIntent with a card (a saved pm id or a test token). Throws
  // with the decline message if the card is declined.
  confirm: (paymentIntentId: string, paymentMethod: string, savePaymentMethod?: boolean) =>
    request<{ status: string }>(
      '/payments/confirm',
      { method: 'POST', body: JSON.stringify({ paymentIntentId, paymentMethod, savePaymentMethod }) },
      true,
    ),

  listMethods: () => request<SavedPaymentMethod[]>('/payments/methods', {}, true),

  addMethod: (paymentMethod: string) =>
    request<SavedPaymentMethod>('/payments/methods', { method: 'POST', body: JSON.stringify({ paymentMethod }) }, true),

  deleteMethod: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/payments/methods/${id}`, { method: 'DELETE' }, true),

  setDefault: (id: string) =>
    request<{ id: string; isDefault: boolean }>(`/payments/methods/${id}/default`, { method: 'POST' }, true),
};

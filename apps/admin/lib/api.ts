// Minimal client for the admin console, calling through the same-origin proxy
// at app/api/[...path]/route.ts (which attaches the httpOnly cookie's token as
// a Bearer header server-side — the browser never sees the raw token).
//
// DRAFT: only implements what apps/admin/app/page.tsx actually calls today
// (adminApi.getRestaurants()). Extend this as the admin console grows.

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  neighborhood: string;
  rating: number;
  numRatings: number;
  isOpen: boolean;
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

export const adminApi = {
  getRestaurants: () => request<Restaurant[]>('/restaurants'),
};

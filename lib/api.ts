const API_BASE = "/rpc";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
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

export interface Restaurant {
  id: string;
  name: string;
  cuisine?: string | null;
  rating?: number | null;
  numRatings?: number | null;
  imageUrl?: string | null;
  neighborhood?: string | null;
}

export const adminApi = {
  getRestaurants: () => request<Restaurant[]>("/admin/restaurants"),
};

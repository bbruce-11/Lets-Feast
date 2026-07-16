"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { adminApi } from "@/lib/api";
import type { Restaurant } from "@/lib/api";
import { LogOut, ShieldCheck, Loader2, Store, Star, Plus } from "lucide-react";

export default function AdminHome() {
  return <AdminDashboard />;
}

function AdminDashboard() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRestaurants = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi.getRestaurants();
      setRestaurants(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load restaurants");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary text-primary-foreground p-2 rounded-md">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">
              Let&apos;s Feast Admin
            </h1>
            <p className="text-xs text-muted-foreground">Platform Console</p>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="h-9 px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </form>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Restaurants</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {restaurants.length} registered restaurant{restaurants.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => router.push("/restaurants/new")}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add Restaurant
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="ml-3">Loading...</span>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 text-destructive p-6 rounded-lg border border-destructive/20 text-center">
            <p className="font-bold mb-2">Error loading data</p>
            <p className="text-sm">{error}</p>
            <button
              onClick={fetchRestaurants}
              className="mt-4 px-4 py-2 rounded-lg border border-destructive/30 hover:bg-destructive/10 text-sm"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {restaurants.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Store className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{r.name}</h3>
                    {r.cuisine && (
                      <p className="text-sm text-muted-foreground">{r.cuisine}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {r.neighborhood && <span>{r.neighborhood}</span>}
                  {r.rating != null && (
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {Number(r.rating).toFixed(1)}
                      {r.numRatings != null && (
                        <span className="opacity-60">({r.numRatings})</span>
                      )}
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-muted-foreground/50 truncate">
                  {r.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

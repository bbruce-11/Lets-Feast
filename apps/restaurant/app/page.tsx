"use client";

import { useEffect, useState, useCallback } from "react";
import { logoutAction } from "@/app/actions/auth";
import { restaurantApi } from "@/lib/api";
import type { ActiveOrder } from "@/lib/api";
import { LogOut, Store, Loader2, Clock, ChevronRight, MapPin, Phone } from "lucide-react";

const STATUS_FLOW = ["confirmed", "preparing", "driver_assigned", "on_the_way", "delivered"];
const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  preparing: "Preparing",
  driver_assigned: "Driver assigned",
  on_the_way: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const POLL_MS = 5000;

export default function RestaurantDashboard() {
  const [orders, setOrders] = useState<ActiveOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advancingId, setAdvancingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await restaurantApi.getActiveOrders();
      setOrders(data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function handleAdvance(id: number) {
    setAdvancingId(id);
    try {
      await restaurantApi.advanceOrder(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to advance order");
    } finally {
      setAdvancingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-md">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Active Orders</h1>
            <p className="text-xs text-muted-foreground">
              {orders?.length ?? 0} order{orders?.length === 1 ? "" : "s"} in progress · all restaurants
            </p>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="h-9 px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </form>
      </header>

      <main className="flex-1 p-6 max-w-3xl mx-auto w-full flex flex-col gap-3">
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-lg border border-destructive/20 text-sm">
            {error}
          </div>
        )}

        {orders === null ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No active orders right now</div>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onAdvance={() => handleAdvance(order.id)}
              isAdvancing={advancingId === order.id}
            />
          ))
        )}
      </main>
    </div>
  );
}

function OrderCard({
  order,
  onAdvance,
  isAdvancing,
}: {
  order: ActiveOrder;
  onAdvance: () => void;
  isAdvancing: boolean;
}) {
  const stepIndex = STATUS_FLOW.indexOf(order.status);
  const nextLabel = stepIndex >= 0 && stepIndex < STATUS_FLOW.length - 1 ? STATUS_LABELS[STATUS_FLOW[stepIndex + 1]] : null;
  const minutesAgo = Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000);

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold">#{order.id}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{order.restaurantName ?? "Unknown restaurant"}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          {minutesAgo <= 0 ? "just now" : `${minutesAgo}m ago`}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span>
              {item.quantity}× {item.name}
            </span>
            <span className="text-muted-foreground">${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>

      {order.deliveryType === "delivery" && order.deliveryAddress && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{order.deliveryAddress}</span>
        </div>
      )}
      {order.customerPhone && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Phone className="w-3.5 h-3.5 shrink-0" />
          {order.customerName ? `${order.customerName} · ` : ""}
          {order.customerPhone}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="font-semibold">${Number.parseFloat(order.total).toFixed(2)}</span>
        {nextLabel && (
          <button
            onClick={onAdvance}
            disabled={isAdvancing}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isAdvancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            Mark {nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}

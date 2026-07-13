import { useState, useMemo } from "react";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { useActiveOrders, useAdvanceOrder, useSetOrderStatus } from "@/hooks/useStaffOrders";
import { StaffOrder, ORDER_STATUS_FLOW, STATUS_LABELS, nextStatus, statusLabel } from "@/lib/types";
import Login from "./login";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LogOut, RefreshCw, ChefHat, Clock, MapPin, Phone, User, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";

export default function Dashboard() {
  const { isAuthenticated, logout } = useStaffAuth();
  
  if (!isAuthenticated) {
    return <Login />;
  }

  return <ActiveOrdersBoard logout={logout} />;
}

function ActiveOrdersBoard({ logout }: { logout: () => void }) {
  const { data: orders, isLoading, error, refetch, isFetching } = useActiveOrders();
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("all");

  const restaurants = useMemo(() => {
    if (!orders) return [];
    const rMap = new Map<string, string>();
    orders.forEach(o => {
      if (o.restaurantId && o.restaurantName) {
        rMap.set(o.restaurantId, o.restaurantName);
      }
    });
    return Array.from(rMap.entries()).map(([id, name]) => ({ id, name }));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    let result = orders;
    if (selectedRestaurant !== "all") {
      result = result.filter(o => o.restaurantId === selectedRestaurant);
    }
    // Sort oldest first
    return result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [orders, selectedRestaurant]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" data-testid="page-dashboard">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary text-primary-foreground p-2 rounded-md">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">Let's Feast Ops</h1>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live System
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
            <SelectTrigger className="w-[200px] h-9" data-testid="select-restaurant-filter">
              <SelectValue placeholder="All Restaurants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Restaurants</SelectItem>
              {restaurants.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()} 
            disabled={isFetching}
            className="h-9 w-9 p-0"
            title="Refresh"
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button variant="ghost" size="sm" onClick={logout} className="h-9 text-muted-foreground hover:text-foreground" data-testid="button-logout">
            <LogOut className="w-4 h-4 mr-2" />
            Exit
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-x-auto">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="ml-3 font-mono">Loading orders...</span>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 text-destructive p-6 rounded-lg max-w-lg mx-auto mt-12 border border-destructive/20 text-center">
            <p className="font-bold mb-2">Connection Error</p>
            <p className="text-sm opacity-90">{error.message}</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>Try Again</Button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-muted-foreground text-center" data-testid="empty-state">
            <CheckCircle2 className="w-16 h-16 mb-4 opacity-20" />
            <h2 className="text-xl font-bold mb-2">No Active Orders</h2>
            <p className="text-sm opacity-70 max-w-sm">
              The kitchen is clear. New orders will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="flex gap-6 pb-6 w-max min-w-full">
            {filteredOrders.map(order => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function OrderCard({ order }: { order: StaffOrder }) {
  const advanceOrder = useAdvanceOrder();
  const setStatus = useSetOrderStatus();
  
  const isAdvancePending = advanceOrder.isPending;
  const isSetPending = setStatus.isPending;
  const isPending = isAdvancePending || isSetPending;

  const next = nextStatus(order.status);
  
  const elapsedMins = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
  
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'confirmed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'preparing': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'driver_assigned': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'on_the_way': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      case 'delivered': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatCurrency = (val: string) => {
    const num = Number(val);
    return isNaN(num) ? "$0.00" : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  return (
    <Card className="w-[340px] flex-shrink-0 flex flex-col border-border bg-card shadow-sm hover:border-primary/30 transition-colors" data-testid={`card-order-${order.id}`}>
      <CardHeader className="p-4 pb-3 border-b border-border/50 bg-muted/30">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col">
            <span className="text-2xl font-black font-mono leading-none tracking-tighter">#{order.id}</span>
            <span className="text-xs text-muted-foreground mt-1 truncate max-w-[150px]" title={order.restaurantName || "Unknown"}>
              {order.restaurantName || "Unknown Restaurant"}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className={`font-mono text-xs uppercase tracking-wider ${getStatusColor(order.status)}`}>
              {statusLabel(order.status)}
            </Badge>
            <div className={`text-xs font-mono flex items-center gap-1 ${elapsedMins > 30 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
              <Clock className="w-3 h-3" />
              {elapsedMins}m ago
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex-1 flex flex-col gap-4 text-sm">
        {/* Customer Info */}
        <div className="bg-muted/30 rounded-md p-3 space-y-2 border border-border/50">
          <div className="flex items-center gap-2 text-foreground">
            <User className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{order.customerName || "Guest"}</span>
          </div>
          {order.customerPhone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4 shrink-0" />
              <span className="font-mono">{order.customerPhone}</span>
            </div>
          )}
          {order.deliveryType === 'delivery' && order.deliveryAddress && (
            <div className="flex items-start gap-2 text-muted-foreground mt-1">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="line-clamp-2 leading-tight">{order.deliveryAddress}</span>
            </div>
          )}
          {order.deliveryType === 'pickup' && (
            <div className="flex items-center gap-2 text-primary font-medium mt-1">
              <span className="w-4 h-4 shrink-0 flex items-center justify-center font-bold">P</span>
              Pickup Order
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="flex-1">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Items</h4>
          <div className="space-y-3">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start gap-3">
                <div className="flex gap-2">
                  <span className="font-mono font-bold text-primary">{item.quantity}x</span>
                  <div>
                    <p className="font-medium leading-tight">{item.name}</p>
                    {item.specialInstructions && (
                      <p className="text-xs text-amber-500/80 mt-1 italic">Note: {item.specialInstructions}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex flex-col gap-3">
        <div className="w-full flex items-center justify-between py-3 border-t border-border/50 text-muted-foreground">
          <span className="text-xs uppercase tracking-wider font-bold">Total</span>
          <span className="font-mono font-bold text-foreground">{formatCurrency(order.subtotal)}</span>
        </div>

        <div className="flex gap-2 w-full">
          <Select 
            value={order.status} 
            onValueChange={(val) => setStatus.mutate({ id: order.id, status: val })}
            disabled={isPending}
          >
            <SelectTrigger className="flex-1 h-10 font-mono text-xs" data-testid={`select-status-${order.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUS_FLOW.map(s => (
                <SelectItem key={s} value={s} className="font-mono text-xs">
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {next && (
            <Button 
              className="flex-1 h-10 font-bold transition-all"
              onClick={() => advanceOrder.mutate(order.id)}
              disabled={isPending}
              data-testid={`button-advance-${order.id}`}
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {statusLabel(next)}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

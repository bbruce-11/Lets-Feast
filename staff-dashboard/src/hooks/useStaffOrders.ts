import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { staffApi } from "@/lib/api";
import type { StaffOrder } from "@/lib/types";

export const activeOrdersQueryKey = ["staff", "orders", "active"] as const;

// Polls the active order list so staff see new orders and status changes without
// a manual refresh. Default poll interval is 5s.
export function useActiveOrders(options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery<StaffOrder[]>({
    queryKey: activeOrdersQueryKey,
    queryFn: staffApi.getActiveOrders,
    refetchInterval: options?.refetchInterval ?? 5000,
    enabled: options?.enabled ?? true,
  });
}

export function useAdvanceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => staffApi.advanceOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activeOrdersQueryKey });
    },
  });
}

export function useSetOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      staffApi.setOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activeOrdersQueryKey });
    },
  });
}

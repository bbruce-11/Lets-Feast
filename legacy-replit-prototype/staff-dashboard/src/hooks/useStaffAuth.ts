import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  clearStaffToken,
  getStaffToken,
  setStaffToken,
  staffApi,
} from "@/lib/api";

// Lightweight staff session: a staff-role JWT held in localStorage. There is no
// per-user account — a single shared passcode gates access to the console.
export function useStaffAuth() {
  const [token, setToken] = useState<string | null>(() => getStaffToken());

  const loginMutation = useMutation({
    mutationFn: (passcode: string) => staffApi.login(passcode),
    onSuccess: (data) => {
      setStaffToken(data.token);
      setToken(data.token);
    },
  });

  const logout = useCallback(() => {
    clearStaffToken();
    setToken(null);
  }, []);

  return {
    isAuthenticated: !!token,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error as Error | null,
    isLoggingIn: loginMutation.isPending,
    logout,
  };
}

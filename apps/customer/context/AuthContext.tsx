import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as api from '@/lib/api';
import type { ApiUser } from '@/lib/api';

interface AuthContextValue {
  user: ApiUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: api.SignUpPayload) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthContextProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On launch: if a token is already saved, verify it's still valid by
  // fetching the current user rather than trusting it blindly.
  useEffect(() => {
    api
      .getMe()
      .then(setUser)
      .catch(() => api.clearToken())
      .finally(() => setIsLoading(false));
  }, []);

  async function signIn(email: string, password: string) {
    const { token, user: signedInUser } = await api.signIn(email, password);
    await api.saveToken(token);
    setUser(signedInUser);
  }

  async function signUp(payload: api.SignUpPayload) {
    const { token, user: newUser } = await api.signUp(payload);
    await api.saveToken(token);
    setUser(newUser);
  }

  async function signOut() {
    await api.clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthContextProvider');
  return ctx;
}

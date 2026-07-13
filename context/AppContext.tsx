import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authApi, saveToken, clearToken, type ApiUser, type SavedAddress } from '@/lib/api';
import {
  addNotificationResponseListener,
  registerForPushNotifications,
  unregisterPushNotifications,
} from '@/lib/pushNotifications';

export interface OnboardingPreferences {
  cuisines: string[];
  allergies: string[];
  dietary: string[];
  radius: string;
  lookingFor: string[];
}

export type { SavedAddress } from '@/lib/api';

export interface User {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  zipCode: string;
  preferences?: OnboardingPreferences;
  savedAddresses: SavedAddress[];
  membershipStatus: 'free' | 'gold' | 'platinum';
  referralCode?: string;
}

interface AppContextType {
  user: User | null;
  isLoading: boolean;
  isOnboarded: boolean;
  signUp: (userData: Partial<User> & { password: string }) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (prefs: OnboardingPreferences) => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const ONBOARDED_KEY = '@feast_onboarded';

// Normalize saved addresses to objects. The server already returns objects, but
// tolerate legacy plain strings defensively so older data still renders.
function normalizeSavedAddresses(raw: ApiUser['savedAddresses'] | undefined): SavedAddress[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a): SavedAddress | null => {
      if (typeof a === 'string') {
        const label = a.trim();
        return label ? { label } : null;
      }
      if (a && typeof a === 'object' && typeof a.label === 'string') {
        const label = a.label.trim();
        if (!label) return null;
        return {
          label,
          lat: typeof a.lat === 'number' ? a.lat : null,
          lng: typeof a.lng === 'number' ? a.lng : null,
        };
      }
      return null;
    })
    .filter((a): a is SavedAddress => a !== null);
}

function apiUserToUser(u: ApiUser): User {
  return {
    id: u.id,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    zipCode: u.zipCode,
    membershipStatus: u.membershipStatus as User['membershipStatus'],
    referralCode: u.referralCode ?? undefined,
    savedAddresses: normalizeSavedAddresses(u.savedAddresses),
    preferences: u.preferences as OnboardingPreferences | undefined,
  };
}

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  // Expo push token registered for the current session, kept so it can be
  // unregistered on sign-out (stops a shared device receiving the previous
  // user's order notifications).
  const pushTokenRef = useRef<string | null>(null);

  const syncPushRegistration = async () => {
    const token = await registerForPushNotifications();
    if (token) pushTokenRef.current = token;
  };

  // Deep-link order-status push taps to the live tracking screen. Covers both a
  // cold start (app launched by the tap) and a background tap (app resumed).
  // No-op on web. Registered once for the app's lifetime.
  useEffect(() => {
    return addNotificationResponseListener((orderId) => {
      router.push({ pathname: '/order/[id]', params: { id: String(orderId) } });
    });
  }, [router]);

  useEffect(() => {
    (async () => {
      try {
        const onboarded = await AsyncStorage.getItem(ONBOARDED_KEY);
        if (onboarded === 'true') setIsOnboarded(true);
        const me = await authApi.me();
        setUser(apiUserToUser(me));
        void syncPushRegistration();
      } catch {
        // Not authenticated or network error — stay logged out
      }
      setIsLoading(false);
    })();
  }, []);

  const signUp = async (userData: Partial<User> & { password: string }) => {
    const { token, user: apiUser } = await authApi.signUp({
      fullName: userData.fullName ?? '',
      phone: userData.phone ?? '',
      email: userData.email ?? '',
      zipCode: userData.zipCode ?? '',
      password: userData.password,
      referralCode: userData.referralCode,
    });
    await saveToken(token);
    setUser(apiUserToUser(apiUser));
    void syncPushRegistration();
  };

  const signIn = async (email: string, password: string) => {
    const { token, user: apiUser } = await authApi.signIn(email, password);
    await saveToken(token);
    const mapped = apiUserToUser(apiUser);
    setUser(mapped);
    setIsOnboarded(true);
    await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
    void syncPushRegistration();
  };

  const signOut = async () => {
    const token = pushTokenRef.current;
    if (token) {
      await unregisterPushNotifications(token);
      pushTokenRef.current = null;
    }
    setUser(null);
    setIsOnboarded(false);
    await clearToken();
    await AsyncStorage.removeItem(ONBOARDED_KEY);
  };

  const completeOnboarding = async (prefs: OnboardingPreferences) => {
    if (user) {
      const updated = await authApi.updateMe({ preferences: prefs });
      setUser(apiUserToUser(updated));
    }
    setIsOnboarded(true);
    await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
  };

  const updateUser = async (updates: Partial<User>) => {
    const apiUpdates: Parameters<typeof authApi.updateMe>[0] = {};
    if (updates.fullName !== undefined) apiUpdates.fullName = updates.fullName;
    if (updates.phone !== undefined) apiUpdates.phone = updates.phone;
    if (updates.zipCode !== undefined) apiUpdates.zipCode = updates.zipCode;
    if (updates.savedAddresses !== undefined) apiUpdates.savedAddresses = updates.savedAddresses;
    if (updates.preferences !== undefined) apiUpdates.preferences = updates.preferences;

    if (Object.keys(apiUpdates).length > 0) {
      try {
        const updated = await authApi.updateMe(apiUpdates);
        setUser(apiUserToUser(updated));
      } catch {
        if (user) setUser({ ...user, ...updates });
      }
    } else if (user) {
      setUser({ ...user, ...updates });
    }
  };

  return (
    <AppContext.Provider value={{ user, isLoading, isOnboarded, signUp, signIn, signOut, completeOnboarding, updateUser }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be within AppContextProvider');
  return ctx;
}

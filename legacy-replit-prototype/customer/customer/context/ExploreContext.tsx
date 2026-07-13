import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  EMPTY_PREFERENCES,
  hasAnyPreference,
  type ExplorePreferences,
} from '@/lib/exploreRecommend';

const STORAGE_KEY = '@feast_explore_prefs';

interface ExploreContextValue {
  preferences: ExplorePreferences;
  hasCompleted: boolean;
  loaded: boolean;
  savePreferences: (prefs: ExplorePreferences) => Promise<void>;
  resetPreferences: () => Promise<void>;
}

const ExploreContext = createContext<ExploreContextValue | undefined>(undefined);

export function ExploreProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] =
    useState<ExplorePreferences>(EMPTY_PREFERENCES);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (active && raw) {
          const parsed = { ...EMPTY_PREFERENCES, ...JSON.parse(raw) };
          setPreferences(parsed);
          setHasCompleted(hasAnyPreference(parsed));
        }
      } catch (_) {
        // Ignore corrupt storage; fall back to empty preferences.
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const savePreferences = useCallback(async (prefs: ExplorePreferences) => {
    setPreferences(prefs);
    setHasCompleted(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (_) {
      // Persistence is best-effort; state is already updated in memory.
    }
  }, []);

  const resetPreferences = useCallback(async () => {
    setPreferences(EMPTY_PREFERENCES);
    setHasCompleted(false);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }, []);

  return (
    <ExploreContext.Provider
      value={{ preferences, hasCompleted, loaded, savePreferences, resetPreferences }}
    >
      {children}
    </ExploreContext.Provider>
  );
}

export function useExplore(): ExploreContextValue {
  const ctx = useContext(ExploreContext);
  if (!ctx) throw new Error('useExplore must be used within an ExploreProvider');
  return ctx;
}

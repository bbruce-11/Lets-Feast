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
import {
  clearStoredPreferences,
  loadStoredPreferences,
  persistPreferences,
} from '@/lib/explorePrefsStorage';

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
      const stored = await loadStoredPreferences();
      if (active && stored) {
        setPreferences(stored);
        setHasCompleted(hasAnyPreference(stored));
      }
      if (active) setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const savePreferences = useCallback(async (prefs: ExplorePreferences) => {
    setPreferences(prefs);
    setHasCompleted(true);
    await persistPreferences(prefs);
  }, []);

  const resetPreferences = useCallback(async () => {
    setPreferences(EMPTY_PREFERENCES);
    setHasCompleted(false);
    await clearStoredPreferences();
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

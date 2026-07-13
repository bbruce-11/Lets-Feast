import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_PREFERENCES, type ExplorePreferences } from './exploreRecommend';

export const EXPLORE_PREFS_STORAGE_KEY = '@feast_explore_prefs';

// Reads saved preferences from storage, tolerating missing or corrupt data.
// Returns null when nothing usable is stored so callers can fall back to
// EMPTY_PREFERENCES without treating it as "completed".
export async function loadStoredPreferences(): Promise<ExplorePreferences | null> {
  try {
    const raw = await AsyncStorage.getItem(EXPLORE_PREFS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return { ...EMPTY_PREFERENCES, ...parsed };
  } catch (_) {
    return null;
  }
}

// Persists edited preferences. Best-effort: in-memory state is the source of
// truth for the current session, so storage failures are swallowed.
export async function persistPreferences(prefs: ExplorePreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(EXPLORE_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (_) {}
}

// Removes saved preferences entirely (the "Clear all" flow).
export async function clearStoredPreferences(): Promise<void> {
  try {
    await AsyncStorage.removeItem(EXPLORE_PREFS_STORAGE_KEY);
  } catch (_) {}
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { restaurants } from '@/data/mockData';
import {
  EMPTY_PREFERENCES,
  hasAnyPreference,
  rankRestaurants,
  type ExplorePreferences,
} from './exploreRecommend';
import {
  EXPLORE_PREFS_STORAGE_KEY,
  clearStoredPreferences,
  loadStoredPreferences,
  persistPreferences,
} from './explorePrefsStorage';

// In-memory stand-in for AsyncStorage so tests exercise the real
// persist/load/clear code paths without a native environment.
const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
}));

function prefs(overrides: Partial<ExplorePreferences>): ExplorePreferences {
  return { ...EMPTY_PREFERENCES, ...overrides };
}

beforeEach(() => {
  store.clear();
});

describe('saving edited preferences', () => {
  it('writes the edited preferences to @feast_explore_prefs', async () => {
    const edited = prefs({ cuisines: ['Thai'], vibes: ['Cozy'] });
    await persistPreferences(edited);

    const raw = store.get(EXPLORE_PREFS_STORAGE_KEY);
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!)).toEqual(edited);
  });

  it('round-trips through load with missing keys backfilled', async () => {
    // Simulate an older payload missing newer preference keys.
    store.set(
      EXPLORE_PREFS_STORAGE_KEY,
      JSON.stringify({ cuisines: ['Thai'] })
    );

    const loaded = await loadStoredPreferences();
    expect(loaded).toEqual(prefs({ cuisines: ['Thai'] }));
    expect(hasAnyPreference(loaded!)).toBe(true);
  });

  it('overwrites previously saved preferences on re-save', async () => {
    await persistPreferences(prefs({ cuisines: ['Thai'] }));
    const edited = prefs({ cuisines: ['Mexican'], foods: ['Tacos'] });
    await persistPreferences(edited);

    const loaded = await loadStoredPreferences();
    expect(loaded).toEqual(edited);
  });

  it('changes rankRestaurants output when preferences are edited', async () => {
    // Before editing: Thai preference puts restaurant 9 on top.
    await persistPreferences(prefs({ cuisines: ['Thai'] }));
    const before = rankRestaurants(restaurants, (await loadStoredPreferences())!);
    expect(before[0].restaurant.id).toBe('9');
    expect(before[0].matchedTags).toContain('Thai');

    // Edit flow: user swaps Thai for Mexican + Tacos and saves.
    await persistPreferences(prefs({ cuisines: ['Mexican'], foods: ['Tacos'] }));
    const after = rankRestaurants(restaurants, (await loadStoredPreferences())!);

    // The re-ranked list must differ and the old top pick must lose its spot.
    expect(after[0].restaurant.id).not.toBe('9');
    expect(after[0].matchedTags.length).toBeGreaterThan(0);
    expect(after.map((r) => r.restaurant.id)).not.toEqual(
      before.map((r) => r.restaurant.id)
    );
  });
});

describe('clearing preferences', () => {
  it('removes the stored entry so nothing is loaded afterwards', async () => {
    await persistPreferences(prefs({ cuisines: ['Thai'] }));
    expect(store.has(EXPLORE_PREFS_STORAGE_KEY)).toBe(true);

    await clearStoredPreferences();
    expect(store.has(EXPLORE_PREFS_STORAGE_KEY)).toBe(false);
    expect(await loadStoredPreferences()).toBeNull();
  });

  it('resets ranking to the unpersonalized default', async () => {
    await persistPreferences(prefs({ cuisines: ['Thai'] }));
    await clearStoredPreferences();

    // The clear flow falls back to EMPTY_PREFERENCES for ranking.
    const fallback = (await loadStoredPreferences()) ?? EMPTY_PREFERENCES;
    expect(fallback).toEqual(EMPTY_PREFERENCES);
    expect(hasAnyPreference(fallback)).toBe(false);

    const ranked = rankRestaurants(restaurants, fallback);
    ranked.forEach((r) => {
      expect(r.matchedTags).toEqual([]);
      expect(r.reason.startsWith('Because you love ')).toBe(false);
    });
  });

  it('returns null for corrupt or non-object stored data', async () => {
    store.set(EXPLORE_PREFS_STORAGE_KEY, 'not-json{');
    expect(await loadStoredPreferences()).toBeNull();

    store.set(EXPLORE_PREFS_STORAGE_KEY, JSON.stringify(['bad']));
    expect(await loadStoredPreferences()).toBeNull();
  });
});

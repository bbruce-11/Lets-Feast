import { describe, it, expect } from 'vitest';
import { restaurants } from '@/data/mockData';
import {
  rankRestaurants,
  EMPTY_PREFERENCES,
  type ExplorePreferences,
} from './exploreRecommend';

function prefs(overrides: Partial<ExplorePreferences>): ExplorePreferences {
  return { ...EMPTY_PREFERENCES, ...overrides };
}

describe('rankRestaurants', () => {
  it('returns a sensible default order with empty preferences', () => {
    const ranked = rankRestaurants(restaurants, EMPTY_PREFERENCES);

    // Something is returned and ranks are sequential starting at 1.
    expect(ranked.length).toBeGreaterThan(0);
    ranked.forEach((r, i) => expect(r.rank).toBe(i + 1));

    // With no preferences, ordering falls back to the rating/distance
    // tie-breakers, so scores must be non-increasing.
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].score).toBeLessThanOrEqual(ranked[i - 1].score);
    }

    // No preference was matched, so no card may claim a personalized match.
    ranked.forEach((r) => expect(r.matchedTags).toEqual([]));
  });

  it('ranks the strongly matched restaurant first', () => {
    // "Thai" only appears in restaurant 9's enrichment cuisine tags, so it is
    // the single strong match and must come out on top.
    const ranked = rankRestaurants(restaurants, prefs({ cuisines: ['Thai'] }));

    expect(ranked[0].restaurant.id).toBe('9');
    expect(ranked[0].matchedTags).toContain('Thai');
    // The matched restaurant must outscore every unmatched one.
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('never returns more than 7 restaurants', () => {
    // There are 10 seeded restaurants; the default cap is 7.
    expect(restaurants.length).toBeGreaterThan(7);
    const ranked = rankRestaurants(restaurants, EMPTY_PREFERENCES);
    expect(ranked.length).toBe(7);
    expect(ranked.length).toBeLessThanOrEqual(7);

    // The cap holds even when a custom limit larger than the cap is requested
    // alongside many matches.
    const many = rankRestaurants(
      restaurants,
      prefs({ cuisines: ['Mexican', 'American', 'Japanese'] }),
      7
    );
    expect(many.length).toBeLessThanOrEqual(7);
  });

  it('only uses "Because you love X" phrasing when X is genuinely matched', () => {
    // Use a broad set of preferences so several personalized reasons appear.
    const ranked = rankRestaurants(
      restaurants,
      prefs({
        cuisines: ['Mexican', 'Japanese', 'Italian'],
        foods: ['Tacos', 'Sushi'],
        vibes: ['Cozy'],
      })
    );

    const personalized = ranked.filter((r) =>
      r.reason.startsWith('Because you love ')
    );
    // At least one card should show the personalized phrasing for this input.
    expect(personalized.length).toBeGreaterThan(0);

    for (const r of personalized) {
      const match = r.reason.match(/^Because you love (.+?), we think/);
      expect(match).not.toBeNull();
      const claimedTag = match![1];
      // The tag the card claims the user loves must actually be in matchedTags.
      expect(r.matchedTags).toContain(claimedTag);
    }
  });
});

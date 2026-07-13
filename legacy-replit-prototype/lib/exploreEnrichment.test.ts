import { describe, it, expect } from 'vitest';
import { restaurants } from '@/data/mockData';
import {
  RESTAURANT_ENRICHMENT,
  VIBE_OPTIONS,
  CUISINE_OPTIONS,
  FOOD_OPTIONS,
  MEAL_TYPE_OPTIONS,
  PRICE_OPTIONS,
} from '@/data/exploreOptions';

describe('RESTAURANT_ENRICHMENT coverage', () => {
  it('has an enrichment entry for every seeded restaurant', () => {
    const missing = restaurants
      .filter((r) => !(r.id in RESTAURANT_ENRICHMENT))
      .map((r) => `${r.id} (${r.name})`);

    expect(
      missing,
      `Restaurants missing from RESTAURANT_ENRICHMENT in data/exploreOptions.ts: ${missing.join(', ')}`
    ).toEqual([]);
  });

  it('has no stale enrichment entries for restaurants that no longer exist', () => {
    const seededIds = new Set(restaurants.map((r) => r.id));
    const stale = Object.keys(RESTAURANT_ENRICHMENT).filter(
      (id) => !seededIds.has(id)
    );

    expect(
      stale,
      `Enrichment entries with no matching seeded restaurant: ${stale.join(', ')}`
    ).toEqual([]);
  });
});

describe('RESTAURANT_ENRICHMENT tag validity', () => {
  const checks: Array<{
    field: 'cuisineTags' | 'vibes' | 'foods' | 'mealTypes';
    options: string[];
    optionsName: string;
  }> = [
    { field: 'cuisineTags', options: CUISINE_OPTIONS, optionsName: 'CUISINE_OPTIONS' },
    { field: 'vibes', options: VIBE_OPTIONS, optionsName: 'VIBE_OPTIONS' },
    { field: 'foods', options: FOOD_OPTIONS, optionsName: 'FOOD_OPTIONS' },
    { field: 'mealTypes', options: MEAL_TYPE_OPTIONS, optionsName: 'MEAL_TYPE_OPTIONS' },
  ];

  for (const { field, options, optionsName } of checks) {
    it(`only uses ${optionsName} tags in "${field}"`, () => {
      const allowed = new Set(options);
      const violations: string[] = [];

      for (const [id, enrichment] of Object.entries(RESTAURANT_ENRICHMENT)) {
        for (const tag of enrichment[field]) {
          if (!allowed.has(tag)) {
            violations.push(`restaurant ${id}: "${tag}" not in ${optionsName}`);
          }
        }
      }

      expect(
        violations,
        `Unmatched ${field} tags (quiz answers can never match these):\n${violations.join('\n')}`
      ).toEqual([]);
    });
  }

  it('only uses valid price tiers from PRICE_OPTIONS', () => {
    const allowed = new Set(PRICE_OPTIONS);
    const violations = Object.entries(RESTAURANT_ENRICHMENT)
      .filter(([, e]) => !allowed.has(e.price))
      .map(([id, e]) => `restaurant ${id}: "${e.price}" not in PRICE_OPTIONS`);

    expect(
      violations,
      `Invalid price tiers:\n${violations.join('\n')}`
    ).toEqual([]);
  });
});

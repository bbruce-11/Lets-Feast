import { type Restaurant, menuItems } from '@/data/mockData';
import {
  RESTAURANT_ENRICHMENT,
  type RestaurantEnrichment,
  priceTier,
  ratingThreshold,
} from '@/data/exploreOptions';

export interface ExplorePreferences {
  vibes: string[];
  cuisines: string[];
  foods: string[];
  dietary: string[];
  mealTypes: string[];
  price: string[];
  ratings: string[];
}

export const EMPTY_PREFERENCES: ExplorePreferences = {
  vibes: [],
  cuisines: [],
  foods: [],
  dietary: [],
  mealTypes: [],
  price: [],
  ratings: [],
};

export interface RankedRestaurant {
  restaurant: Restaurant;
  rank: number;
  score: number;
  matchedTags: string[];
  reason: string;
  price: string;
  closesAt: string;
  waitLabel: string;
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, '');

function enrichmentFor(r: Restaurant): RestaurantEnrichment {
  const found = RESTAURANT_ENRICHMENT[r.id];
  if (found) return found;
  const firstMins = parseInt(r.deliveryTime, 10);
  return {
    cuisineTags: [r.cuisine],
    vibes: [],
    foods: [],
    mealTypes: [],
    price: r.rating >= 4.7 ? '$$$' : '$$',
    closesAt: '10:00 PM',
    waitMins: Number.isNaN(firstMins) ? 25 : firstMins,
  };
}

function signatureDish(restaurantId: string): string {
  const item = menuItems.find((m) => m.restaurantId === restaurantId);
  return item?.name ?? '';
}

function buildReason(
  r: Restaurant,
  matched: string[]
): string {
  const dish = signatureDish(r.id);
  // Personalized phrasing is only used when there is a real matched tag, so a
  // card never claims to match preferences it didn't actually match.
  if (matched.length && dish) {
    return `Because you love ${matched[0]}, we think you'd enjoy the ${dish}.`;
  }
  if (matched.length) {
    return `A great match for ${matched.slice(0, 2).join(' & ')}.`;
  }
  if (dish) {
    return `A local favorite — try the ${dish}.`;
  }
  return `A local favorite we think you'll love.`;
}

export function hasAnyPreference(p: ExplorePreferences): boolean {
  return (
    p.vibes.length +
      p.cuisines.length +
      p.foods.length +
      p.dietary.length +
      p.mealTypes.length +
      p.price.length +
      p.ratings.length >
    0
  );
}

export function rankRestaurants(
  restaurants: Restaurant[],
  prefs: ExplorePreferences,
  limit = 7
): RankedRestaurant[] {
  const ranked = restaurants.map((r) => {
    const enr = enrichmentFor(r);
    let score = 0;
    const matched: string[] = [];
    const pushMatch = (tag: string) => {
      if (!matched.includes(tag)) matched.push(tag);
    };

    for (const c of prefs.cuisines) {
      if (enr.cuisineTags.some((t) => norm(t) === norm(c))) {
        score += 3;
        pushMatch(c);
      }
    }
    for (const f of prefs.foods) {
      if (enr.foods.some((t) => norm(t) === norm(f))) {
        score += 2;
        pushMatch(f);
      }
    }
    for (const d of prefs.dietary) {
      if (r.dietaryTags.some((t) => norm(t) === norm(d))) {
        score += 3;
        pushMatch(d);
      }
    }
    for (const v of prefs.vibes) {
      if (enr.vibes.some((t) => norm(t) === norm(v))) {
        score += 1.5;
        pushMatch(v);
      }
    }
    for (const m of prefs.mealTypes) {
      if (enr.mealTypes.some((t) => norm(t) === norm(m))) {
        score += 1;
        pushMatch(m);
      }
    }

    if (prefs.price.length) {
      const tier = priceTier(enr.price);
      const tiers = prefs.price.map(priceTier);
      if (tiers.includes(tier)) score += 1.5;
      else if (tier <= Math.max(...tiers)) score += 0.5;
      else score -= 1;
    }

    if (prefs.ratings.length) {
      const thr = Math.min(...prefs.ratings.map(ratingThreshold));
      if (r.rating >= thr) score += 2;
      else score -= 2;
    }

    // Tie-breakers: prefer higher rated and closer restaurants.
    score += r.rating * 0.4;
    const miles = parseFloat(r.distance);
    if (!Number.isNaN(miles)) score += Math.max(0, 3 - miles) * 0.4;

    return {
      restaurant: r,
      score,
      matchedTags: matched.slice(0, 3),
      reason: buildReason(r, matched),
      price: enr.price,
      closesAt: enr.closesAt,
      waitLabel: `${enr.waitMins} min wait`,
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit).map((x, i) => ({ ...x, rank: i + 1 }));
}

// Option sets for the Explore discovery questionnaire plus on-device
// enrichment used to rank restaurants. No backend/DB changes are involved —
// price, vibes, meal types and closing times are derived here on the device.

export const VIBE_OPTIONS = [
  'Casual', 'Cozy', 'Lively', 'Trendy', 'Classy', 'Elegant', 'Romantic',
  'Quiet', 'Relaxed', 'Modern', 'Traditional', 'Local', 'Friendly',
  'Unique', 'Health Conscious', 'Luxurious', 'Quirky',
];

// Note: no "Fast" option, per the discovery design.
export const CUISINE_OPTIONS = [
  'Mexican', 'Tex-Mex', 'American', 'Soul', 'Southern', 'Italian',
  'Japanese', 'Thai', 'Asian', 'Mediterranean', 'Latin', 'Cajun',
  'Vegan', 'Comfort', 'Seafood',
];

export const FOOD_OPTIONS = [
  'Tacos', 'Burritos', 'Burgers', 'Sandwiches', 'Pizza', 'Pasta', 'Sushi',
  'Seafood', 'BBQ', 'Wings', 'Soup', 'Salad', 'Bread', 'Smoothies', 'Juice',
  'Dessert', 'Comfort Food', 'Family Meals', 'Charcuterie Board',
  'Anything Spicy', 'Fish & Chips',
];

export const DIETARY_OPTIONS = [
  'Vegan', 'Vegetarian', 'Gluten-Free', 'Halal', 'High Protein',
  'Pescatarian', 'Dairy-Free', 'Nut-Free', 'No Pork', 'No Restrictions',
];

export const MEAL_TYPE_OPTIONS = [
  'Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Late Night', 'Snack',
  'Quick Bite', 'Family Meals', 'Multiple Courses', 'Drinks', 'Happy Hour',
  'Bar Food',
];

export const PRICE_OPTIONS = ['$', '$$', '$$$', '$$$$', '$$$$$'];

export const RATING_OPTIONS = [
  '1 Star +', '2 Stars +', '3 Stars +', '4 Stars +', '5 Stars',
];

export interface RestaurantEnrichment {
  cuisineTags: string[];
  vibes: string[];
  foods: string[];
  mealTypes: string[];
  price: string;
  closesAt: string;
  waitMins: number;
}

// Curated per-restaurant signals keyed by restaurant id. Drives matching and
// the on-device fields (price tier, closing time, wait time) that the API
// does not provide.
export const RESTAURANT_ENRICHMENT: Record<string, RestaurantEnrichment> = {
  '1': {
    cuisineTags: ['Mexican', 'Tex-Mex', 'Latin'],
    vibes: ['Casual', 'Lively', 'Local', 'Friendly'],
    foods: ['Tacos', 'Burritos', 'Anything Spicy', 'Family Meals'],
    mealTypes: ['Lunch', 'Dinner', 'Quick Bite', 'Late Night'],
    price: '$', closesAt: '10:00 PM', waitMins: 20,
  },
  '2': {
    cuisineTags: ['American', 'Comfort', 'Southern'],
    vibes: ['Casual', 'Modern', 'Friendly', 'Lively'],
    foods: ['Burgers', 'Sandwiches', 'Comfort Food', 'Wings'],
    mealTypes: ['Lunch', 'Dinner', 'Happy Hour', 'Bar Food'],
    price: '$$', closesAt: '11:00 PM', waitMins: 25,
  },
  '3': {
    cuisineTags: ['Soul', 'Southern', 'American', 'Cajun', 'Comfort'],
    vibes: ['Casual', 'Cozy', 'Traditional', 'Local', 'Friendly'],
    foods: ['BBQ', 'Comfort Food', 'Family Meals', 'Wings'],
    mealTypes: ['Lunch', 'Dinner', 'Family Meals'],
    price: '$$', closesAt: '10:30 PM', waitMins: 30,
  },
  '4': {
    cuisineTags: ['Japanese', 'Asian', 'Comfort'],
    vibes: ['Trendy', 'Cozy', 'Lively', 'Modern', 'Quirky'],
    foods: ['Soup', 'Comfort Food', 'Anything Spicy'],
    mealTypes: ['Lunch', 'Dinner', 'Late Night'],
    price: '$$', closesAt: '11:00 PM', waitMins: 25,
  },
  '5': {
    cuisineTags: ['Mexican', 'Tex-Mex', 'Latin'],
    vibes: ['Lively', 'Classy', 'Trendy', 'Friendly', 'Unique'],
    foods: ['Tacos', 'Burritos', 'Seafood', 'Family Meals', 'Anything Spicy'],
    mealTypes: ['Lunch', 'Dinner', 'Brunch', 'Drinks'],
    price: '$$', closesAt: '10:30 PM', waitMins: 20,
  },
  '6': {
    cuisineTags: ['American', 'Seafood', 'Comfort'],
    vibes: ['Classy', 'Elegant', 'Luxurious', 'Romantic'],
    foods: ['Seafood', 'Comfort Food', 'Charcuterie Board', 'Salad'],
    mealTypes: ['Dinner', 'Multiple Courses', 'Drinks', 'Happy Hour'],
    price: '$$$$', closesAt: '11:30 PM', waitMins: 35,
  },
  '7': {
    cuisineTags: ['Japanese', 'Asian', 'Seafood'],
    vibes: ['Trendy', 'Classy', 'Modern', 'Elegant', 'Unique'],
    foods: ['Sushi', 'Seafood', 'Fish & Chips'],
    mealTypes: ['Lunch', 'Dinner', 'Drinks', 'Happy Hour'],
    price: '$$$', closesAt: '10:30 PM', waitMins: 20,
  },
  '8': {
    cuisineTags: ['Italian', 'Mediterranean', 'Comfort'],
    vibes: ['Casual', 'Cozy', 'Friendly', 'Lively', 'Local'],
    foods: ['Pizza', 'Pasta', 'Bread', 'Comfort Food', 'Family Meals'],
    mealTypes: ['Lunch', 'Dinner', 'Late Night', 'Family Meals'],
    price: '$$', closesAt: '11:00 PM', waitMins: 25,
  },
  '9': {
    cuisineTags: ['Thai', 'Asian'],
    vibes: ['Cozy', 'Relaxed', 'Quiet', 'Health Conscious', 'Unique'],
    foods: ['Soup', 'Anything Spicy', 'Seafood'],
    mealTypes: ['Lunch', 'Dinner'],
    price: '$$', closesAt: '10:00 PM', waitMins: 30,
  },
  '10': {
    cuisineTags: ['Vegan', 'Mediterranean', 'Health Conscious'],
    vibes: ['Health Conscious', 'Modern', 'Relaxed', 'Trendy', 'Quiet'],
    foods: ['Salad', 'Smoothies', 'Juice', 'Bread', 'Dessert'],
    mealTypes: ['Breakfast', 'Lunch', 'Brunch', 'Snack', 'Quick Bite'],
    price: '$$', closesAt: '9:00 PM', waitMins: 15,
  },
};

export function priceTier(price: string): number {
  return (price.match(/\$/g) ?? []).length || 1;
}

export function ratingThreshold(label: string): number {
  const n = parseInt(label, 10);
  return Number.isNaN(n) ? 0 : n;
}

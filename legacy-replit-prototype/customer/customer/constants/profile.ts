// Mock customer rewards/profile values surfaced across the Profile section.
// These are presentation-only placeholders (no backend) shared so the Profile
// tab and the Rewards screen stay in sync.
export const REWARDS_POINTS = 240;
export const REWARDS_TIER = 'Feast Member';

export interface Reward {
  id: string;
  name: string;
  desc: string;
  points: number;
  icon: string;
}

export const REWARDS: Reward[] = [
  { id: 'fw3', name: '$3 off next Feast Window', desc: 'Save on your next Feast Window order', points: 150, icon: 'time' },
  { id: 'drink', name: 'One Drink member deal', desc: 'A complimentary drink at partner bars', points: 300, icon: 'beer' },
  { id: 'f360', name: 'Feast 360 ticket discount', desc: 'Discount on pop-up dining events', points: 400, icon: 'sparkles' },
  { id: 'freedelivery', name: 'Free delivery', desc: 'Free delivery on your next order', points: 500, icon: 'bicycle' },
];

// AsyncStorage keys for mock, on-device profile state.
export const STORAGE_KEYS = {
  paymentMethods: '@feast_payment_methods',
  foodPrefs: '@feast_food_prefs',
  settings: '@feast_settings',
  redeemedRewards: '@feast_redeemed_rewards',
} as const;

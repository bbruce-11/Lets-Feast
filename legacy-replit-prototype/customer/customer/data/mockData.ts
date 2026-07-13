export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  neighborhood: string;
  rating: number;
  numRatings: number;
  distance: string;
  deliveryTime: string;
  pickupTime: string;
  isOpen: boolean;
  imageIndex: number;
  bgColor: string;
  lat?: number;
  lng?: number;
  allergyTags: string[];
  dietaryTags: string[];
  categories: string[];
  feastWindowId?: string;
  memberDeal?: string;
}

export interface FeastWindow {
  id: string;
  restaurantId: string;
  deliveryStart: string;
  deliveryEnd: string;
  spotsTotal: number;
  spotsFilled: number;
  discount: number;
  endTime: number;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  category: string;
  name: string;
  description: string;
  price: number;
  allergyTags: string[];
  dietaryTags: string[];
  imageIndex: number;
}

export interface OneDrinkVenue {
  id: string;
  name: string;
  type: string;
  neighborhood: string;
  deal: string;
  rating: number;
  distance: string;
}

export interface ReservaRestaurant {
  id: string;
  name: string;
  cuisine: string;
  neighborhood: string;
  rating: number;
  priceRange: string;
  nextAvailable: string;
}

export interface CateringPackage {
  id: string;
  name: string;
  description: string;
  serves: string;
  price: number;
  cuisine: string;
}

export interface GroceryProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  imageIndex: number;
}

export interface Feast360Event {
  id: string;
  name: string;
  description: string;
  date: string;
  venue: string;
  neighborhood: string;
  price: number;
  imageIndex: number;
}

const now = Date.now();

export const feastWindows: FeastWindow[] = [
  { id: 'fw1', restaurantId: '1', deliveryStart: '12:30 PM', deliveryEnd: '1:00 PM', spotsTotal: 12, spotsFilled: 7, discount: 3, endTime: now + 6 * 60 * 1000 },
  { id: 'fw2', restaurantId: '3', deliveryStart: '1:00 PM', deliveryEnd: '1:30 PM', spotsTotal: 10, spotsFilled: 4, discount: 2.5, endTime: now + 12 * 60 * 1000 },
  { id: 'fw3', restaurantId: '5', deliveryStart: '12:45 PM', deliveryEnd: '1:15 PM', spotsTotal: 15, spotsFilled: 9, discount: 4, endTime: now + 8 * 60 * 1000 },
  { id: 'fw4', restaurantId: '8', deliveryStart: '1:15 PM', deliveryEnd: '1:45 PM', spotsTotal: 8, spotsFilled: 3, discount: 3.5, endTime: now + 15 * 60 * 1000 },
  { id: 'fw5', restaurantId: '10', deliveryStart: '12:15 PM', deliveryEnd: '12:45 PM', spotsTotal: 12, spotsFilled: 11, discount: 2, endTime: now + 4 * 60 * 1000 },
];

export const restaurants: Restaurant[] = [
  { id: '1', name: 'El Barrio Taco Shop', cuisine: 'Mexican', neighborhood: 'Belmont Cragin', rating: 4.7, numRatings: 1243, distance: '0.8 mi', deliveryTime: '20-30 min', pickupTime: '10 min', isOpen: true, imageIndex: 1, bgColor: '#8B2E0D', lat: 41.9275, lng: -87.7665, allergyTags: ['Gluten', 'Dairy'], dietaryTags: ['Halal'], categories: ['Popular', 'Appetizers', 'Entrees', 'Combos', 'Family Meals', 'Drinks', 'Desserts'], feastWindowId: 'fw1', memberDeal: '10% off orders over $25' },
  { id: '2', name: 'The Logan Table', cuisine: 'American', neighborhood: 'Logan Square', rating: 4.5, numRatings: 892, distance: '1.2 mi', deliveryTime: '25-35 min', pickupTime: '12 min', isOpen: true, imageIndex: 0, bgColor: '#2C3E50', lat: 41.9295, lng: -87.7073, allergyTags: ['Gluten', 'Dairy', 'Eggs'], dietaryTags: [], categories: ['Popular', 'Appetizers', 'Entrees', 'Combos', 'Family Meals', 'Drinks', 'Specials'] },
  { id: '3', name: 'Humboldt BBQ & Soul', cuisine: 'Soul Food', neighborhood: 'Humboldt Park', rating: 4.8, numRatings: 2156, distance: '1.5 mi', deliveryTime: '30-40 min', pickupTime: '15 min', isOpen: true, imageIndex: 2, bgColor: '#6B2D0E', lat: 41.9036, lng: -87.701, allergyTags: ['Gluten', 'Dairy'], dietaryTags: ['No pork'], categories: ['Popular', 'Appetizers', 'Entrees', 'Family Meals', 'Drinks', 'Desserts'], feastWindowId: 'fw2' },
  { id: '4', name: 'Wicker Park Ramen Co', cuisine: 'Japanese', neighborhood: 'Wicker Park', rating: 4.6, numRatings: 1087, distance: '2.1 mi', deliveryTime: '30-45 min', pickupTime: '15 min', isOpen: true, imageIndex: 0, bgColor: '#1A3A5C', lat: 41.9088, lng: -87.6796, allergyTags: ['Gluten', 'Soy', 'Shellfish', 'Sesame'], dietaryTags: [], categories: ['Popular', 'Appetizers', 'Entrees', 'Drinks', 'Specials'] },
  { id: '5', name: 'La Catrina Kitchen', cuisine: 'Mexican', neighborhood: 'Pilsen', rating: 4.9, numRatings: 3421, distance: '1.8 mi', deliveryTime: '25-35 min', pickupTime: '10 min', isOpen: true, imageIndex: 1, bgColor: '#7B1FA2', lat: 41.8567, lng: -87.6565, allergyTags: ['Gluten', 'Dairy'], dietaryTags: ['Halal', 'Vegetarian'], categories: ['Popular', 'Appetizers', 'Entrees', 'Combos', 'Family Meals', 'Drinks', 'Specials'], feastWindowId: 'fw3' },
  { id: '6', name: 'Randolph Street Grill', cuisine: 'American', neighborhood: 'West Loop', rating: 4.4, numRatings: 756, distance: '3.2 mi', deliveryTime: '35-50 min', pickupTime: '20 min', isOpen: true, imageIndex: 2, bgColor: '#1B5E20', lat: 41.882, lng: -87.648, allergyTags: ['Gluten', 'Dairy', 'Eggs'], dietaryTags: [], categories: ['Popular', 'Appetizers', 'Entrees', 'Combos', 'Drinks', 'Desserts'], memberDeal: '$5 off first delivery' },
  { id: '7', name: 'South Loop Sushi Bar', cuisine: 'Japanese', neighborhood: 'South Loop', rating: 4.7, numRatings: 1654, distance: '2.8 mi', deliveryTime: '30-45 min', pickupTime: '15 min', isOpen: true, imageIndex: 0, bgColor: '#0D47A1', lat: 41.8676, lng: -87.627, allergyTags: ['Shellfish', 'Soy', 'Sesame', 'Fish'], dietaryTags: [], categories: ['Popular', 'Appetizers', 'Entrees', 'Combos', 'Drinks', 'Specials'] },
  { id: '8', name: 'Pizza Parlor Logan', cuisine: 'Italian', neighborhood: 'Logan Square', rating: 4.6, numRatings: 1923, distance: '1.3 mi', deliveryTime: '25-35 min', pickupTime: '12 min', isOpen: true, imageIndex: 1, bgColor: '#B71C1C', lat: 41.923, lng: -87.7085, allergyTags: ['Gluten', 'Dairy', 'Eggs'], dietaryTags: ['Vegetarian'], categories: ['Popular', 'Appetizers', 'Entrees', 'Combos', 'Family Meals', 'Drinks', 'Desserts'], feastWindowId: 'fw4' },
  { id: '9', name: 'Thai Lotus Garden', cuisine: 'Thai', neighborhood: 'Wicker Park', rating: 4.5, numRatings: 987, distance: '2.0 mi', deliveryTime: '30-40 min', pickupTime: '15 min', isOpen: true, imageIndex: 2, bgColor: '#4A148C', lat: 41.91, lng: -87.675, allergyTags: ['Peanuts', 'Tree nuts', 'Shellfish', 'Soy', 'Gluten'], dietaryTags: ['Gluten-free', 'Vegan'], categories: ['Popular', 'Appetizers', 'Entrees', 'Combos', 'Family Meals', 'Drinks', 'Specials'] },
  { id: '10', name: 'Green Roots Cafe', cuisine: 'Vegan', neighborhood: 'Pilsen', rating: 4.8, numRatings: 1342, distance: '1.9 mi', deliveryTime: '20-30 min', pickupTime: '10 min', isOpen: true, imageIndex: 0, bgColor: '#1B5E20', lat: 41.855, lng: -87.66, allergyTags: ['Tree nuts', 'Soy', 'Gluten'], dietaryTags: ['Vegan', 'Gluten-free', 'High-protein'], categories: ['Popular', 'Appetizers', 'Entrees', 'Combos', 'Family Meals', 'Drinks', 'Desserts'], feastWindowId: 'fw5', memberDeal: 'Free delivery on orders over $20' },
];

export const menuItems: MenuItem[] = [
  // El Barrio Taco Shop (id: '1')
  { id: 'm1', restaurantId: '1', category: 'Popular', name: 'Birria Tacos', description: 'Slow-cooked beef birria in crispy corn tortillas, consommé for dipping, onion, cilantro', price: 13.99, allergyTags: ['Gluten', 'Dairy'], dietaryTags: ['Halal'], imageIndex: 1 },
  { id: 'm2', restaurantId: '1', category: 'Appetizers', name: 'Street Corn Elote', description: 'Grilled corn with mayo, cotija cheese, chili powder, and lime', price: 6.99, allergyTags: ['Dairy', 'Eggs'], dietaryTags: ['Vegetarian'], imageIndex: 1 },
  { id: 'm3', restaurantId: '1', category: 'Entrees', name: 'Enchilada Plate', description: 'Three enchiladas with your choice of filling, red or green sauce, rice and beans', price: 15.99, allergyTags: ['Gluten', 'Dairy'], dietaryTags: ['Halal'], imageIndex: 1 },
  { id: 'm4', restaurantId: '1', category: 'Family Meals', name: 'Family Burrito Pack', description: '6 large burritos with choice of protein, rice, beans, guac, and salsa', price: 45.99, allergyTags: ['Gluten', 'Dairy'], dietaryTags: ['Halal'], imageIndex: 1 },
  { id: 'm5', restaurantId: '1', category: 'Drinks', name: 'Fresh Horchata', description: 'Homemade rice milk with cinnamon and vanilla', price: 3.99, allergyTags: [], dietaryTags: ['Vegan'], imageIndex: 1 },
  // The Logan Table (id: '2')
  { id: 'm6', restaurantId: '2', category: 'Popular', name: 'Smash Burger', description: 'Double smash patties, American cheese, shredded lettuce, onion, special sauce, brioche bun', price: 14.99, allergyTags: ['Gluten', 'Dairy', 'Eggs'], dietaryTags: [], imageIndex: 0 },
  { id: 'm7', restaurantId: '2', category: 'Appetizers', name: 'Onion Rings', description: 'Beer-battered thick-cut onion rings with chipotle dipping sauce', price: 7.99, allergyTags: ['Gluten', 'Dairy', 'Eggs'], dietaryTags: ['Vegetarian'], imageIndex: 0 },
  { id: 'm8', restaurantId: '2', category: 'Entrees', name: 'BBQ Chicken Sandwich', description: 'Grilled chicken breast, smoky BBQ, coleslaw, pickles on toasted brioche', price: 13.99, allergyTags: ['Gluten', 'Dairy', 'Eggs'], dietaryTags: [], imageIndex: 0 },
  { id: 'm9', restaurantId: '2', category: 'Family Meals', name: 'Family Platter', description: '4 burgers or sandwiches, 2 large sides, and 4 drinks', price: 52.99, allergyTags: ['Gluten', 'Dairy', 'Eggs'], dietaryTags: [], imageIndex: 0 },
  { id: 'm10', restaurantId: '2', category: 'Drinks', name: 'Craft Lemonade', description: 'Fresh-squeezed lemonade with mint and a choice of flavor', price: 4.99, allergyTags: [], dietaryTags: ['Vegan'], imageIndex: 0 },
  // Humboldt BBQ & Soul (id: '3')
  { id: 'm11', restaurantId: '3', category: 'Popular', name: 'Rib Tips Basket', description: 'Fall-off-the-bone pork rib tips with house BBQ sauce, fries, and slaw', price: 16.99, allergyTags: ['Gluten', 'Dairy'], dietaryTags: [], imageIndex: 2 },
  { id: 'm12', restaurantId: '3', category: 'Appetizers', name: 'Fried Okra', description: 'Southern-style fried okra with remoulade dipping sauce', price: 5.99, allergyTags: ['Gluten', 'Eggs'], dietaryTags: ['Vegetarian'], imageIndex: 2 },
  { id: 'm13', restaurantId: '3', category: 'Entrees', name: 'Mac & Cheese Bowl', description: 'Creamy 5-cheese macaroni with optional smoked brisket topping', price: 12.99, allergyTags: ['Gluten', 'Dairy', 'Eggs'], dietaryTags: ['Vegetarian'], imageIndex: 2 },
  { id: 'm14', restaurantId: '3', category: 'Family Meals', name: 'Sunday Dinner Pack', description: 'Full rack of ribs, 4 sides, cornbread, and a gallon of sweet tea', price: 65.99, allergyTags: ['Gluten', 'Dairy'], dietaryTags: [], imageIndex: 2 },
  { id: 'm15', restaurantId: '3', category: 'Drinks', name: 'Sweet Tea', description: 'Georgia-style sweetened iced tea, brewed fresh daily', price: 2.99, allergyTags: [], dietaryTags: ['Vegan'], imageIndex: 2 },
  // Wicker Park Ramen Co (id: '4')
  { id: 'm16', restaurantId: '4', category: 'Popular', name: 'Tonkotsu Ramen', description: 'Rich pork bone broth, chashu pork belly, marinated egg, nori, menma bamboo shoots', price: 16.99, allergyTags: ['Gluten', 'Soy', 'Eggs', 'Sesame'], dietaryTags: [], imageIndex: 0 },
  { id: 'm17', restaurantId: '4', category: 'Appetizers', name: 'Pan-Fried Gyoza', description: '6-piece pork and cabbage dumplings, crispy bottom, ginger-soy dipping sauce', price: 8.99, allergyTags: ['Gluten', 'Soy', 'Sesame'], dietaryTags: [], imageIndex: 0 },
  { id: 'm18', restaurantId: '4', category: 'Entrees', name: 'Spicy Miso Ramen', description: 'Hokkaido miso broth with chili oil, ground pork, corn, butter, and scallions', price: 15.99, allergyTags: ['Gluten', 'Soy', 'Dairy'], dietaryTags: [], imageIndex: 0 },
  { id: 'm19', restaurantId: '4', category: 'Family Meals', name: 'Ramen Family Box', description: '4 bowls of ramen, 2 orders of gyoza, and 4 Japanese sodas', price: 59.99, allergyTags: ['Gluten', 'Soy', 'Eggs', 'Sesame'], dietaryTags: [], imageIndex: 0 },
  { id: 'm20', restaurantId: '4', category: 'Drinks', name: 'Ramune Japanese Soda', description: 'Marble bottle Japanese soda, choice of original, lychee, or strawberry', price: 3.99, allergyTags: [], dietaryTags: ['Vegan'], imageIndex: 0 },
  // La Catrina Kitchen (id: '5')
  { id: 'm21', restaurantId: '5', category: 'Popular', name: 'Al Pastor Tacos', description: 'Marinated pork with pineapple, onion, and cilantro on house-made corn tortillas', price: 13.99, allergyTags: ['Gluten'], dietaryTags: ['Halal'], imageIndex: 1 },
  { id: 'm22', restaurantId: '5', category: 'Appetizers', name: 'Queso Fundido', description: 'Melted Oaxacan cheese with chorizo and roasted poblano, served with warm tortillas', price: 9.99, allergyTags: ['Dairy', 'Gluten'], dietaryTags: [], imageIndex: 1 },
  { id: 'm23', restaurantId: '5', category: 'Entrees', name: 'Molcajete Mixto', description: 'Grilled meats and shrimp in a volcanic stone bowl with cactus and jalapeño salsa', price: 19.99, allergyTags: ['Shellfish', 'Dairy'], dietaryTags: ['Halal'], imageIndex: 1 },
  { id: 'm24', restaurantId: '5', category: 'Family Meals', name: 'Fiesta Pack', description: '20 tacos, rice, beans, guacamole, and drinks for the whole crew', price: 55.99, allergyTags: ['Gluten', 'Dairy'], dietaryTags: ['Halal'], imageIndex: 1 },
  { id: 'm25', restaurantId: '5', category: 'Drinks', name: 'Agua Fresca', description: 'Daily-made fruit water - hibiscus, tamarind, or cucumber melon', price: 3.49, allergyTags: [], dietaryTags: ['Vegan'], imageIndex: 1 },
  // Randolph Street Grill (id: '6')
  { id: 'm26', restaurantId: '6', category: 'Popular', name: 'Prime Ribeye', description: '16oz USDA Prime ribeye, herb butter, garlic mashed potatoes, and seasonal veg', price: 38.99, allergyTags: ['Dairy', 'Eggs'], dietaryTags: [], imageIndex: 2 },
  { id: 'm27', restaurantId: '6', category: 'Appetizers', name: 'Wedge Salad', description: 'Iceberg wedge, blue cheese crumbles, bacon, tomato, red onion, balsamic', price: 12.99, allergyTags: ['Dairy', 'Eggs'], dietaryTags: ['Gluten-free'], imageIndex: 2 },
  { id: 'm28', restaurantId: '6', category: 'Entrees', name: 'Grilled Salmon', description: 'Atlantic salmon fillet, lemon caper butter, wild rice, asparagus', price: 28.99, allergyTags: ['Fish', 'Dairy'], dietaryTags: ['Gluten-free'], imageIndex: 2 },
  { id: 'm29', restaurantId: '6', category: 'Combos', name: 'Surf & Turf Combo', description: '8oz filet mignon and lobster tail, two sides of your choice', price: 65.99, allergyTags: ['Shellfish', 'Fish', 'Dairy'], dietaryTags: ['Gluten-free'], imageIndex: 2 },
  { id: 'm30', restaurantId: '6', category: 'Drinks', name: 'House Sparkling Water', description: 'Chilled sparkling water with lemon and cucumber', price: 3.99, allergyTags: [], dietaryTags: ['Vegan'], imageIndex: 2 },
  // South Loop Sushi Bar (id: '7')
  { id: 'm31', restaurantId: '7', category: 'Popular', name: 'Dragon Roll', description: 'Shrimp tempura, avocado, topped with tuna and eel sauce', price: 16.99, allergyTags: ['Shellfish', 'Fish', 'Gluten', 'Soy', 'Sesame'], dietaryTags: [], imageIndex: 0 },
  { id: 'm32', restaurantId: '7', category: 'Appetizers', name: 'Edamame', description: 'Salted steamed soybeans', price: 5.99, allergyTags: ['Soy'], dietaryTags: ['Vegan'], imageIndex: 0 },
  { id: 'm33', restaurantId: '7', category: 'Entrees', name: 'Salmon Sashimi', description: '8 pieces of premium Norwegian salmon sashimi with wasabi and pickled ginger', price: 18.99, allergyTags: ['Fish', 'Soy', 'Sesame'], dietaryTags: ['Gluten-free'], imageIndex: 0 },
  { id: 'm34', restaurantId: '7', category: 'Family Meals', name: 'Sushi Family Box', description: '60 pieces of assorted rolls and nigiri, miso soup, and edamame', price: 79.99, allergyTags: ['Shellfish', 'Fish', 'Gluten', 'Soy', 'Sesame'], dietaryTags: [], imageIndex: 0 },
  { id: 'm35', restaurantId: '7', category: 'Drinks', name: 'Miso Soup', description: 'Traditional dashi broth with tofu, wakame, and scallions', price: 3.99, allergyTags: ['Soy'], dietaryTags: ['Vegan'], imageIndex: 0 },
  // Pizza Parlor Logan (id: '8')
  { id: 'm36', restaurantId: '8', category: 'Popular', name: 'Margherita Pizza', description: 'San Marzano tomato, fresh mozzarella, basil, extra virgin olive oil, 12-inch', price: 17.99, allergyTags: ['Gluten', 'Dairy'], dietaryTags: ['Vegetarian'], imageIndex: 1 },
  { id: 'm37', restaurantId: '8', category: 'Appetizers', name: 'Garlic Parmesan Bread', description: 'Toasted sourdough with roasted garlic butter and shaved parmesan', price: 5.99, allergyTags: ['Gluten', 'Dairy', 'Eggs'], dietaryTags: ['Vegetarian'], imageIndex: 1 },
  { id: 'm38', restaurantId: '8', category: 'Entrees', name: 'Penne Arrabiata', description: 'Rigatoni in spicy San Marzano tomato sauce with basil and pecorino romano', price: 14.99, allergyTags: ['Gluten', 'Dairy'], dietaryTags: ['Vegetarian'], imageIndex: 1 },
  { id: 'm39', restaurantId: '8', category: 'Family Meals', name: 'Family Pizza Bundle', description: '3 large pizzas with up to 3 toppings each, and 2-liter soda', price: 49.99, allergyTags: ['Gluten', 'Dairy', 'Eggs'], dietaryTags: ['Vegetarian'], imageIndex: 1 },
  { id: 'm40', restaurantId: '8', category: 'Drinks', name: 'Italian Cream Soda', description: 'Sparkling Italian soda with your choice of flavored cream', price: 3.99, allergyTags: ['Dairy'], dietaryTags: ['Vegetarian'], imageIndex: 1 },
  // Thai Lotus Garden (id: '9')
  { id: 'm41', restaurantId: '9', category: 'Popular', name: 'Pad Thai', description: 'Stir-fried rice noodles with shrimp, tofu, bean sprouts, peanuts, and tamarind sauce', price: 15.99, allergyTags: ['Shellfish', 'Peanuts', 'Soy', 'Gluten', 'Eggs'], dietaryTags: [], imageIndex: 2 },
  { id: 'm42', restaurantId: '9', category: 'Appetizers', name: 'Fresh Spring Rolls', description: '3 rice paper rolls with shrimp, vermicelli, herbs, and peanut sauce', price: 7.99, allergyTags: ['Shellfish', 'Peanuts', 'Soy'], dietaryTags: ['Gluten-free'], imageIndex: 2 },
  { id: 'm43', restaurantId: '9', category: 'Entrees', name: 'Green Curry Chicken', description: 'Aromatic green curry with coconut milk, Thai basil, eggplant, and jasmine rice', price: 16.99, allergyTags: ['Shellfish'], dietaryTags: ['Gluten-free'], imageIndex: 2 },
  { id: 'm44', restaurantId: '9', category: 'Family Meals', name: 'Thai Family Box', description: '4 entrees, 2 appetizers, jasmine rice, and spring rolls for 4', price: 62.99, allergyTags: ['Peanuts', 'Shellfish', 'Soy', 'Gluten', 'Eggs'], dietaryTags: [], imageIndex: 2 },
  { id: 'm45', restaurantId: '9', category: 'Drinks', name: 'Thai Iced Tea', description: 'Creamy blended black tea with condensed milk, served over ice', price: 4.99, allergyTags: ['Dairy'], dietaryTags: ['Vegetarian'], imageIndex: 2 },
  // Green Roots Cafe (id: '10')
  { id: 'm46', restaurantId: '10', category: 'Popular', name: 'Buddha Bowl', description: 'Brown rice, roasted chickpeas, avocado, kale, cucumber, tahini dressing', price: 14.99, allergyTags: ['Soy', 'Sesame', 'Tree nuts'], dietaryTags: ['Vegan', 'Gluten-free', 'High-protein'], imageIndex: 0 },
  { id: 'm47', restaurantId: '10', category: 'Appetizers', name: 'Hummus Trio Platter', description: 'House-made classic, beet, and roasted garlic hummus with seasonal veggies', price: 8.99, allergyTags: ['Sesame', 'Soy'], dietaryTags: ['Vegan', 'Gluten-free'], imageIndex: 0 },
  { id: 'm48', restaurantId: '10', category: 'Entrees', name: 'Jackfruit Tacos', description: 'BBQ jackfruit in corn tortillas with avocado crema, slaw, and pickled jalapeños', price: 13.99, allergyTags: ['Soy'], dietaryTags: ['Vegan', 'Gluten-free'], imageIndex: 0 },
  { id: 'm49', restaurantId: '10', category: 'Family Meals', name: 'Vegan Family Pack', description: '4 entrees, 2 apps, and 4 drinks for a full plant-based feast', price: 49.99, allergyTags: ['Soy', 'Tree nuts', 'Sesame', 'Gluten'], dietaryTags: ['Vegan'], imageIndex: 0 },
  { id: 'm50', restaurantId: '10', category: 'Drinks', name: 'Green Detox Smoothie', description: 'Spinach, banana, ginger, cucumber, lemon, coconut water', price: 6.99, allergyTags: [], dietaryTags: ['Vegan', 'Gluten-free'], imageIndex: 0 },
];

export const oneDrinkVenues: OneDrinkVenue[] = [
  { id: 'od1', name: 'The Empty Bottle', type: 'Bar', neighborhood: 'Wicker Park', deal: '2-for-1 craft beers before 10 PM', rating: 4.6, distance: '1.4 mi' },
  { id: 'od2', name: 'Celeste Rooftop Lounge', type: 'Lounge', neighborhood: 'West Loop', deal: 'Member cocktail: $8 signature drinks all night', rating: 4.8, distance: '3.1 mi' },
  { id: 'od3', name: 'La Paloma Social Club', type: 'Club', neighborhood: 'Pilsen', deal: 'Free first drink with Feast membership', rating: 4.7, distance: '2.0 mi' },
  { id: 'od4', name: 'Bungalow by Middle Brow', type: 'Bar', neighborhood: 'Logan Square', deal: 'Happy hour pints: $5 all local craft beers', rating: 4.5, distance: '1.6 mi' },
  { id: 'od5', name: 'Bordel Chicago', type: 'Lounge', neighborhood: 'West Loop', deal: '$10 wine and cocktails during Feast hour', rating: 4.9, distance: '3.4 mi' },
];

export const reservaRestaurants: ReservaRestaurant[] = [
  { id: 'r1', name: 'Randolph Street Grill', cuisine: 'American', neighborhood: 'West Loop', rating: 4.4, priceRange: '$$$', nextAvailable: 'Tonight at 7:30 PM' },
  { id: 'r2', name: 'La Catrina Kitchen', cuisine: 'Mexican', neighborhood: 'Pilsen', rating: 4.9, priceRange: '$$', nextAvailable: 'Tonight at 6:00 PM' },
  { id: 'r3', name: 'South Loop Sushi Bar', cuisine: 'Japanese', neighborhood: 'South Loop', rating: 4.7, priceRange: '$$$', nextAvailable: 'Tomorrow at 7:00 PM' },
];

export const cateringPackages: CateringPackage[] = [
  { id: 'c1', name: 'Office Lunch Package', description: 'Sandwich and salad spread for 10-20 people. Setup and cleanup included.', serves: '10-20 people', price: 18.99, cuisine: 'American' },
  { id: 'c2', name: 'Taco Bar Fiesta', description: 'Full Mexican taco bar with all the fixings, chips, guac, and drinks for large events.', serves: '25-50 people', price: 22.99, cuisine: 'Mexican' },
  { id: 'c3', name: 'BBQ & Soul Cookout', description: 'Full BBQ spread with ribs, chicken, sides, and all the Southern comfort you can handle.', serves: '30-60 people', price: 26.99, cuisine: 'Soul Food' },
];

export const groceryProducts: GroceryProduct[] = [
  { id: 'g1', name: 'Organic Baby Spinach', category: 'Produce', price: 4.99, unit: '5 oz bag', imageIndex: 0 },
  { id: 'g2', name: 'Whole Milk', category: 'Dairy', price: 3.49, unit: '1 gallon', imageIndex: 1 },
  { id: 'g3', name: 'Sourdough Bread', category: 'Bakery', price: 5.99, unit: 'loaf', imageIndex: 2 },
  { id: 'g4', name: 'Free-Range Eggs', category: 'Dairy', price: 6.99, unit: 'dozen', imageIndex: 0 },
  { id: 'g5', name: 'Avocados', category: 'Produce', price: 1.49, unit: 'each', imageIndex: 1 },
  { id: 'g6', name: 'Black Beans', category: 'Pantry', price: 1.29, unit: '15 oz can', imageIndex: 2 },
  { id: 'g7', name: 'Greek Yogurt', category: 'Dairy', price: 3.99, unit: '32 oz', imageIndex: 0 },
  { id: 'g8', name: 'Olive Oil', category: 'Pantry', price: 8.99, unit: '500ml bottle', imageIndex: 1 },
  { id: 'g9', name: 'Sparkling Water 12pk', category: 'Beverages', price: 7.99, unit: '12 cans', imageIndex: 2 },
  { id: 'g10', name: 'Mixed Berries', category: 'Produce', price: 5.49, unit: '1 lb', imageIndex: 0 },
];

export const feast360Events: Feast360Event[] = [
  { id: 'e1', name: 'Pilsen Night Market', description: 'Pop-up food market with 20+ local vendors, live salsa music, and artisan goods. A celebration of Pilsen culture and cuisine.', date: 'Fri, Jun 7 • 5–10 PM', venue: 'Playa Vista Outdoor', neighborhood: 'Pilsen', price: 5, imageIndex: 1 },
  { id: 'e2', name: 'Logan Square Sunday Brunch Fest', description: 'Six of Logan Square\'s best brunch spots set up in one place. DJs, bottomless mimosas, and a farmers market alongside.', date: 'Sun, Jun 9 • 10 AM–3 PM', venue: 'Logan Square Greystone', neighborhood: 'Logan Square', price: 15, imageIndex: 0 },
  { id: 'e3', name: 'Humboldt Park Caribbean Night', description: 'A tropical dining experience featuring Caribbean food from Puerto Rico, Jamaica, and Cuba, plus live reggaeton and cumbia.', date: 'Sat, Jun 15 • 6–11 PM', venue: 'Humboldt Park Boathouse', neighborhood: 'Humboldt Park', price: 10, imageIndex: 2 },
];

export const getFeastWindow = (feastWindowId: string): FeastWindow | undefined =>
  feastWindows.find((fw) => fw.id === feastWindowId);

export const getRestaurant = (id: string): Restaurant | undefined =>
  restaurants.find((r) => r.id === id);

export const getMenuItems = (restaurantId: string): MenuItem[] =>
  menuItems.filter((m) => m.restaurantId === restaurantId);

export const getMenuCategories = (restaurantId: string): string[] => {
  const restaurant = getRestaurant(restaurantId);
  return restaurant?.categories ?? [];
};

export const getRestaurantsWithFeastWindows = (): Restaurant[] =>
  restaurants.filter((r) => r.feastWindowId);

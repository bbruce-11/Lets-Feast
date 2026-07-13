#!/usr/bin/env node
/**
 * Seed script — inserts Let's Feast mock data into the database.
 * Safe to run multiple times (ON CONFLICT DO NOTHING / DO UPDATE).
 */
import pg from 'pg';

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const now = Date.now();
const HOUR = 60 * 60 * 1000;

try {
  // ── Restaurants ──────────────────────────────────────────────────────────
  await client.query(`
    INSERT INTO restaurants (id, name, cuisine, neighborhood, rating, num_ratings, distance, delivery_time, pickup_time, is_open, image_index, bg_color, allergy_tags, dietary_tags, categories, feast_window_id, member_deal)
    VALUES
      ('1','El Barrio Taco Shop','Mexican','Belmont Cragin',4.7,1243,'0.8 mi','20-30 min','10 min',true,1,'#8B2E0D','["Gluten","Dairy"]','["Halal"]','["Popular","Appetizers","Entrees","Combos","Family Meals","Drinks","Desserts"]',null,'10% off orders over $25'),
      ('2','The Logan Table','American','Logan Square',4.5,892,'1.2 mi','25-35 min','12 min',true,0,'#2C3E50','["Gluten","Dairy","Eggs"]','[]','["Popular","Appetizers","Entrees","Combos","Family Meals","Drinks","Specials"]',null,null),
      ('3','Humboldt BBQ & Soul','Soul Food','Humboldt Park',4.8,2156,'1.5 mi','30-40 min','15 min',true,2,'#6B2D0E','["Gluten","Dairy"]','["No pork"]','["Popular","Appetizers","Entrees","Family Meals","Drinks","Desserts"]',null,null),
      ('4','Wicker Park Ramen Co','Japanese','Wicker Park',4.6,1087,'2.1 mi','30-45 min','15 min',true,0,'#1A3A5C','["Gluten","Soy","Shellfish","Sesame"]','[]','["Popular","Appetizers","Entrees","Drinks","Specials"]',null,null),
      ('5','La Catrina Kitchen','Mexican','Pilsen',4.9,3421,'1.8 mi','25-35 min','10 min',true,1,'#7B1FA2','["Gluten","Dairy"]','["Halal","Vegetarian"]','["Popular","Appetizers","Entrees","Combos","Family Meals","Drinks","Specials"]',null,null),
      ('6','Randolph Street Grill','American','West Loop',4.4,756,'3.2 mi','35-50 min','20 min',true,2,'#1B5E20','["Gluten","Dairy","Eggs"]','[]','["Popular","Appetizers","Entrees","Combos","Drinks","Desserts"]',null,'$5 off first delivery'),
      ('7','South Loop Sushi Bar','Japanese','South Loop',4.7,1654,'2.8 mi','30-45 min','15 min',true,0,'#0D47A1','["Shellfish","Soy","Sesame","Fish"]','[]','["Popular","Appetizers","Entrees","Combos","Drinks","Specials"]',null,null),
      ('8','Pizza Parlor Logan','Italian','Logan Square',4.6,1923,'1.3 mi','25-35 min','12 min',true,1,'#B71C1C','["Gluten","Dairy","Eggs"]','["Vegetarian"]','["Popular","Appetizers","Entrees","Combos","Family Meals","Drinks","Desserts"]',null,null),
      ('9','Thai Lotus Garden','Thai','Wicker Park',4.5,987,'2.0 mi','30-40 min','15 min',true,2,'#4A148C','["Peanuts","Tree nuts","Shellfish","Soy","Gluten"]','["Gluten-free","Vegan"]','["Popular","Appetizers","Entrees","Combos","Family Meals","Drinks","Specials"]',null,null),
      ('10','Green Roots Cafe','Vegan','Pilsen',4.8,1342,'1.9 mi','20-30 min','10 min',true,0,'#1B5E20','["Tree nuts","Soy","Gluten"]','["Vegan","Gluten-free","High-protein"]','["Popular","Appetizers","Entrees","Combos","Family Meals","Drinks","Desserts"]',null,'Free delivery on orders over $20')
    ON CONFLICT (id) DO NOTHING
  `);
  console.log('✓ restaurants');

  // ── Feast Windows ─────────────────────────────────────────────────────────
  await client.query(`
    INSERT INTO feast_windows (id, restaurant_id, delivery_start, delivery_end, spots_total, spots_filled, discount, end_time)
    VALUES
      ('fw1','1','12:30 PM','1:00 PM',12,7,3.00,$1),
      ('fw2','3','1:00 PM','1:30 PM',10,4,2.50,$2),
      ('fw3','5','12:45 PM','1:15 PM',15,9,4.00,$3),
      ('fw4','8','1:15 PM','1:45 PM',8,3,3.50,$4),
      ('fw5','10','12:15 PM','12:45 PM',12,11,2.00,$5)
    ON CONFLICT (id) DO UPDATE SET
      end_time = EXCLUDED.end_time
  `, [now + 6*HOUR, now + 8*HOUR, now + 5*HOUR, now + 7*HOUR, now + 4*HOUR]);
  console.log('✓ feast_windows');

  // ── Link restaurants → feast windows ─────────────────────────────────────
  await client.query(`
    UPDATE restaurants SET feast_window_id = 'fw1' WHERE id = '1' AND feast_window_id IS NULL;
    UPDATE restaurants SET feast_window_id = 'fw2' WHERE id = '3' AND feast_window_id IS NULL;
    UPDATE restaurants SET feast_window_id = 'fw3' WHERE id = '5' AND feast_window_id IS NULL;
    UPDATE restaurants SET feast_window_id = 'fw4' WHERE id = '8' AND feast_window_id IS NULL;
    UPDATE restaurants SET feast_window_id = 'fw5' WHERE id = '10' AND feast_window_id IS NULL;
  `);
  console.log('✓ restaurant → feast_window links');

  // ── Menu Items ────────────────────────────────────────────────────────────
  await client.query(`
    INSERT INTO menu_items (id, restaurant_id, category, name, description, price, allergy_tags, dietary_tags, image_index)
    VALUES
      ('m1','1','Popular','Birria Tacos','Slow-cooked beef birria in crispy corn tortillas, consommé for dipping, onion, cilantro',13.99,'["Gluten","Dairy"]','["Halal"]',1),
      ('m2','1','Appetizers','Street Corn Elote','Grilled corn with mayo, cotija cheese, chili powder, and lime',6.99,'["Dairy","Eggs"]','["Vegetarian"]',1),
      ('m3','1','Entrees','Enchilada Plate','Three enchiladas with your choice of filling, red or green sauce, rice and beans',15.99,'["Gluten","Dairy"]','["Halal"]',1),
      ('m4','1','Family Meals','Family Burrito Pack','6 large burritos with choice of protein, rice, beans, guac, and salsa',45.99,'["Gluten","Dairy"]','["Halal"]',1),
      ('m5','1','Drinks','Fresh Horchata','Homemade rice milk with cinnamon and vanilla',3.99,'[]','["Vegan"]',1),
      ('m6','2','Popular','Smash Burger','Double smash patties, American cheese, shredded lettuce, onion, special sauce, brioche bun',14.99,'["Gluten","Dairy","Eggs"]','[]',0),
      ('m7','2','Appetizers','Onion Rings','Beer-battered thick-cut onion rings with chipotle dipping sauce',7.99,'["Gluten","Dairy","Eggs"]','["Vegetarian"]',0),
      ('m8','2','Entrees','BBQ Chicken Sandwich','Grilled chicken breast, smoky BBQ, coleslaw, pickles on toasted brioche',13.99,'["Gluten","Dairy","Eggs"]','[]',0),
      ('m9','2','Family Meals','Family Platter','4 burgers or sandwiches, 2 large sides, and 4 drinks',52.99,'["Gluten","Dairy","Eggs"]','[]',0),
      ('m10','2','Drinks','Craft Lemonade','Fresh-squeezed lemonade with mint and a choice of flavor',4.99,'[]','["Vegan"]',0),
      ('m11','3','Popular','Rib Tips Basket','Fall-off-the-bone pork rib tips with house BBQ sauce, fries, and slaw',16.99,'["Gluten","Dairy"]','[]',2),
      ('m12','3','Appetizers','Fried Okra','Southern-style fried okra with remoulade dipping sauce',5.99,'["Gluten","Eggs"]','["Vegetarian"]',2),
      ('m13','3','Entrees','Mac & Cheese Bowl','Creamy 5-cheese macaroni with optional smoked brisket topping',12.99,'["Gluten","Dairy","Eggs"]','["Vegetarian"]',2),
      ('m14','3','Family Meals','Sunday Dinner Pack','Full rack of ribs, 4 sides, cornbread, and a gallon of sweet tea',65.99,'["Gluten","Dairy"]','[]',2),
      ('m15','3','Drinks','Sweet Tea','Georgia-style sweetened iced tea, brewed fresh daily',2.99,'[]','["Vegan"]',2),
      ('m16','4','Popular','Tonkotsu Ramen','Rich pork bone broth, chashu pork belly, marinated egg, nori, menma bamboo shoots',16.99,'["Gluten","Soy","Eggs","Sesame"]','[]',0),
      ('m17','4','Appetizers','Pan-Fried Gyoza','6-piece pork and cabbage dumplings, crispy bottom, ginger-soy dipping sauce',8.99,'["Gluten","Soy","Sesame"]','[]',0),
      ('m18','4','Entrees','Spicy Miso Ramen','Hokkaido miso broth with chili oil, ground pork, corn, butter, and scallions',15.99,'["Gluten","Soy","Dairy"]','[]',0),
      ('m19','4','Family Meals','Ramen Family Box','4 bowls of ramen, 2 orders of gyoza, and 4 Japanese sodas',59.99,'["Gluten","Soy","Eggs","Sesame"]','[]',0),
      ('m20','4','Drinks','Ramune Japanese Soda','Marble bottle Japanese soda, choice of original, lychee, or strawberry',3.99,'[]','["Vegan"]',0),
      ('m21','5','Popular','Al Pastor Tacos','Marinated pork with pineapple, onion, and cilantro on house-made corn tortillas',13.99,'["Gluten"]','["Halal"]',1),
      ('m22','5','Appetizers','Queso Fundido','Melted Oaxacan cheese with chorizo and roasted poblano, served with warm tortillas',9.99,'["Dairy","Gluten"]','[]',1),
      ('m23','5','Entrees','Molcajete Mixto','Grilled meats and shrimp in a volcanic stone bowl with cactus and jalapeño salsa',19.99,'["Shellfish","Dairy"]','["Halal"]',1),
      ('m24','5','Family Meals','Fiesta Pack','20 tacos, rice, beans, guacamole, and drinks for the whole crew',55.99,'["Gluten","Dairy"]','["Halal"]',1),
      ('m25','5','Drinks','Agua Fresca','Daily-made fruit water - hibiscus, tamarind, or cucumber melon',3.49,'[]','["Vegan"]',1),
      ('m26','6','Popular','Prime Ribeye','16oz USDA Prime ribeye, herb butter, garlic mashed potatoes, and seasonal veg',38.99,'["Dairy","Eggs"]','[]',2),
      ('m27','6','Appetizers','Wedge Salad','Iceberg wedge, blue cheese crumbles, bacon, tomato, red onion, balsamic',12.99,'["Dairy","Eggs"]','["Gluten-free"]',2),
      ('m28','6','Entrees','Grilled Salmon','Atlantic salmon fillet, lemon caper butter, wild rice, asparagus',28.99,'["Fish","Dairy"]','["Gluten-free"]',2),
      ('m29','6','Combos','Surf & Turf Combo','8oz filet mignon and lobster tail, two sides of your choice',65.99,'["Shellfish","Fish","Dairy"]','["Gluten-free"]',2),
      ('m30','6','Drinks','House Sparkling Water','Chilled sparkling water with lemon and cucumber',3.99,'[]','["Vegan"]',2),
      ('m31','7','Popular','Dragon Roll','Shrimp tempura, avocado, topped with tuna and eel sauce',16.99,'["Shellfish","Fish","Gluten","Soy","Sesame"]','[]',0),
      ('m32','7','Appetizers','Edamame','Salted steamed soybeans',5.99,'["Soy"]','["Vegan"]',0),
      ('m33','7','Entrees','Salmon Sashimi','8 pieces of premium Norwegian salmon sashimi with wasabi and pickled ginger',18.99,'["Fish","Soy","Sesame"]','["Gluten-free"]',0),
      ('m34','7','Family Meals','Sushi Family Box','60 pieces of assorted rolls and nigiri, miso soup, and edamame',79.99,'["Shellfish","Fish","Gluten","Soy","Sesame"]','[]',0),
      ('m35','7','Drinks','Miso Soup','Traditional dashi broth with tofu, wakame, and scallions',3.99,'["Soy"]','["Vegan"]',0),
      ('m36','8','Popular','Margherita Pizza','San Marzano tomato, fresh mozzarella, basil, extra virgin olive oil, 12-inch',17.99,'["Gluten","Dairy"]','["Vegetarian"]',1),
      ('m37','8','Appetizers','Garlic Parmesan Bread','Toasted sourdough with roasted garlic butter and shaved parmesan',5.99,'["Gluten","Dairy","Eggs"]','["Vegetarian"]',1),
      ('m38','8','Entrees','Penne Arrabiata','Rigatoni in spicy San Marzano tomato sauce with basil and pecorino romano',14.99,'["Gluten","Dairy"]','["Vegetarian"]',1),
      ('m39','8','Family Meals','Family Pizza Bundle','3 large pizzas with up to 3 toppings each, and 2-liter soda',49.99,'["Gluten","Dairy","Eggs"]','["Vegetarian"]',1),
      ('m40','8','Drinks','Italian Cream Soda','Sparkling Italian soda with your choice of flavored cream',3.99,'["Dairy"]','["Vegetarian"]',1),
      ('m41','9','Popular','Pad Thai','Stir-fried rice noodles with shrimp, tofu, bean sprouts, peanuts, and tamarind sauce',15.99,'["Shellfish","Peanuts","Soy","Gluten","Eggs"]','[]',2),
      ('m42','9','Appetizers','Fresh Spring Rolls','3 rice paper rolls with shrimp, vermicelli, herbs, and peanut sauce',7.99,'["Shellfish","Peanuts","Soy"]','["Gluten-free"]',2),
      ('m43','9','Entrees','Green Curry Chicken','Aromatic green curry with coconut milk, Thai basil, eggplant, and jasmine rice',16.99,'["Shellfish"]','["Gluten-free"]',2),
      ('m44','9','Family Meals','Thai Family Box','4 entrees, 2 appetizers, jasmine rice, and spring rolls for 4',62.99,'["Peanuts","Shellfish","Soy","Gluten","Eggs"]','[]',2),
      ('m45','9','Drinks','Thai Iced Tea','Creamy blended black tea with condensed milk, served over ice',4.99,'["Dairy"]','["Vegetarian"]',2),
      ('m46','10','Popular','Buddha Bowl','Brown rice, roasted chickpeas, avocado, kale, cucumber, tahini dressing',14.99,'["Soy","Sesame","Tree nuts"]','["Vegan","Gluten-free","High-protein"]',0),
      ('m47','10','Appetizers','Hummus Trio Platter','House-made classic, beet, and roasted garlic hummus with seasonal veggies',8.99,'["Sesame","Soy"]','["Vegan","Gluten-free"]',0),
      ('m48','10','Entrees','Jackfruit Tacos','BBQ jackfruit in corn tortillas with avocado crema, slaw, and pickled jalapeños',13.99,'["Soy"]','["Vegan","Gluten-free"]',0),
      ('m49','10','Family Meals','Vegan Family Pack','4 entrees, 2 apps, and 4 drinks for a full plant-based feast',49.99,'["Soy","Tree nuts","Sesame","Gluten"]','["Vegan"]',0),
      ('m50','10','Drinks','Green Detox Smoothie','Spinach, banana, ginger, cucumber, lemon, coconut water',6.99,'[]','["Vegan","Gluten-free"]',0)
    ON CONFLICT (id) DO NOTHING
  `);
  console.log('✓ menu_items');

  console.log('Seed complete.');
} finally {
  await client.end();
}

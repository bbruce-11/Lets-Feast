import { pgTable, serial, text, numeric, integer, boolean, jsonb, bigint, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
// drizzle-zod@0.8 emits Zod v4 schemas, so we must infer types from the matching
// Zod v4 entrypoint. Importing the default "zod" (v3) entrypoint here makes
// `z.infer<typeof createInsertSchema(...)>` fail its constraint and silently
// collapses every export of this module ("has no exported member ...").
import { z } from "zod/v4";

// The set of user roles the platform supports. Only `customer` is active in the
// current phase, but the others exist so restaurant, driver, and admin
// dashboards can be added later without reworking auth or the schema. A user's
// role is always set server-side (defaults to `customer` on signup) and is never
// accepted from a client request body.
export const USER_ROLES = ["customer", "restaurant_staff", "driver", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().unique(),
  zipCode: text("zip_code").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  // Server-controlled authorization role. Defaults to `customer`; never settable
  // by the client. See USER_ROLES for the allowed values.
  role: text("role").notNull().default("customer"),
  membershipStatus: text("membership_status").notNull().default("free"),
  referralCode: text("referral_code"),
  // The user's Stripe Customer id, created lazily the first time they pay (test
  // mode). Saved payment methods attach to this customer. Never a card number.
  stripeCustomerId: text("stripe_customer_id"),
  savedAddresses: jsonb("saved_addresses").notNull().default([]),
  preferences: jsonb("preferences"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const restaurantsTable = pgTable("restaurants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  cuisine: text("cuisine").notNull(),
  neighborhood: text("neighborhood").notNull(),
  rating: numeric("rating", { precision: 3, scale: 1 }).notNull().default("0"),
  numRatings: integer("num_ratings").notNull().default(0),
  distance: text("distance").notNull().default(""),
  deliveryTime: text("delivery_time").notNull().default(""),
  pickupTime: text("pickup_time").notNull().default(""),
  isOpen: boolean("is_open").notNull().default(true),
  imageIndex: integer("image_index").notNull().default(0),
  bgColor: text("bg_color").notNull().default("#000000"),
  lat: numeric("lat", { precision: 9, scale: 6 }),
  lng: numeric("lng", { precision: 9, scale: 6 }),
  allergyTags: jsonb("allergy_tags").notNull().default([]),
  dietaryTags: jsonb("dietary_tags").notNull().default([]),
  categories: jsonb("categories").notNull().default([]),
  feastWindowId: text("feast_window_id"),
  memberDeal: text("member_deal"),
});

export const menuItemsTable = pgTable("menu_items", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id")
    .notNull()
    .references(() => restaurantsTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  allergyTags: jsonb("allergy_tags").notNull().default([]),
  dietaryTags: jsonb("dietary_tags").notNull().default([]),
  imageIndex: integer("image_index").notNull().default(0),
});

export const feastWindowsTable = pgTable("feast_windows", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id")
    .notNull()
    .references(() => restaurantsTable.id, { onDelete: "cascade" }),
  deliveryStart: text("delivery_start").notNull(),
  deliveryEnd: text("delivery_end").notNull(),
  spotsTotal: integer("spots_total").notNull(),
  spotsFilled: integer("spots_filled").notNull().default(0),
  discount: numeric("discount", { precision: 5, scale: 2 }).notNull().default("0"),
  endTime: bigint("end_time", { mode: "number" }).notNull(),
});

export const feastWindowMembersTable = pgTable(
  "feast_window_members",
  {
    feastWindowId: text("feast_window_id")
      .notNull()
      .references(() => feastWindowsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.feastWindowId, table.userId] })],
);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  restaurantId: text("restaurant_id")
    .notNull()
    .references(() => restaurantsTable.id),
  feastWindowId: text("feast_window_id").references(() => feastWindowsTable.id),
  deliveryType: text("delivery_type").notNull().default("delivery"),
  // The delivery address text entered at checkout, persisted so the tracking
  // map can derive/show the real destination when tracking from order history.
  deliveryAddress: text("delivery_address"),
  // The precise drop-off coordinates from the selected saved-address pin (absent
  // when the order used a typed address with no pin, or for pickup orders).
  deliveryLat: numeric("delivery_lat", { precision: 9, scale: 6 }),
  deliveryLng: numeric("delivery_lng", { precision: 9, scale: 6 }),
  // The driver assigned to deliver this order. Nullable for now — no driver
  // dashboard or assignment flow exists yet — but present so future driver-facing
  // features have the relationship ready without a schema rebuild.
  driverId: integer("driver_id").references(() => usersTable.id),
  items: jsonb("items").notNull().default([]),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  // The amount actually charged for this order, computed server-side as
  // subtotal + delivery + service fee - feast-window discount. Nullable for
  // legacy orders placed before Stripe checkout existed.
  total: numeric("total", { precision: 10, scale: 2 }),
  // Stripe test-mode payment references. We store only the PaymentIntent id and
  // non-sensitive card metadata (brand + last4) returned by the confirmed
  // intent — never a raw card number. `paymentIntentId` is unique so a single
  // successful intent can back exactly one order (replay/double-spend guard).
  paymentIntentId: text("payment_intent_id").unique(),
  paymentStatus: text("payment_status"),
  cardBrand: text("card_brand"),
  cardLast4: text("card_last4"),
  status: text("status").notNull().default("placed"),
  // Wall-clock timestamps recorded the first time the order entered each status.
  // Populated as the status changes (manually or via the time-based simulation)
  // so future restaurant/driver/admin dashboards can show real stage history.
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  preparingAt: timestamp("preparing_at", { withTimezone: true }),
  driverAssignedAt: timestamp("driver_assigned_at", { withTimezone: true }),
  onTheWayAt: timestamp("on_the_way_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  // When true, the status was set manually by restaurant/driver staff and the
  // time-based simulation must no longer auto-advance or override it. Manual
  // updates always take precedence over deriveOrderStatus().
  statusManual: boolean("status_manual").notNull().default(false),
  rating: integer("rating"),
  ratingComment: text("rating_comment"),
  ratedAt: timestamp("rated_at", { withTimezone: true }),
  // Highest order status for which a status-change notification has already been
  // sent/handled. Used by the server-side notification scheduler so each status
  // is only ever notified once, even across server restarts.
  notifiedStatus: text("notified_status"),
  // Last time the customer's tracking screen polled this order. Acts as a
  // presence signal so the notification scheduler can suppress a push when the
  // confirmation screen is open (the in-app local notification handles it) and
  // only push when the app is backgrounded/closed.
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Per-order line items, stored as an immutable snapshot taken at purchase time.
// `name` and `unitPrice` are frozen copies of the menu item's values when the
// order was placed, so later menu/price edits never rewrite past orders. The
// server is the source of truth: these rows are written from DB-looked-up prices
// (never from client-supplied amounts) in the same transaction as the order.
// `menuItemId` keeps the (text) reference to the original menu item for reorder.
export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "cascade" }),
  menuItemId: text("menu_item_id")
    .notNull()
    .references(() => menuItemsTable.id),
  name: text("name").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  specialInstructions: text("special_instructions"),
});

// Expo push tokens registered by customer devices. A device's token is the
// primary key (upserted), so re-registering a token simply re-points it at the
// current user. Tokens are removed when Expo reports them as unregistered.
export const pushTokensTable = pgTable("push_tokens", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  platform: text("platform"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Links staff users to the restaurant(s) they work for. A composite primary key
// of (user_id, restaurant_id) lets one restaurant have many staff and one user
// work across multiple restaurants. No UI consumes this yet — it exists so the
// future restaurant dashboard can scope a staff member's access to their own
// restaurant(s) without a schema rebuild.
export const restaurantStaffTable = pgTable(
  "restaurant_staff",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurantsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.restaurantId] })],
);

// A saved delivery address. `lat`/`lng` are the precise drop-off coordinates set
// via the map pin picker (absent for legacy text-only addresses).
export const savedAddressSchema = z.object({
  label: z.string().min(1),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});
export type SavedAddress = z.infer<typeof savedAddressSchema>;

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertRestaurantSchema = createInsertSchema(restaurantsTable);
export const insertMenuItemSchema = createInsertSchema(menuItemsTable);
export const insertFeastWindowSchema = createInsertSchema(feastWindowsTable);
export const insertFeastWindowMemberSchema = createInsertSchema(feastWindowMembersTable);
export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true });
export const insertPushTokenSchema = createInsertSchema(pushTokensTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertRestaurantStaffSchema = createInsertSchema(restaurantStaffTable).omit({
  createdAt: true,
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Restaurant = typeof restaurantsTable.$inferSelect;
export type MenuItem = typeof menuItemsTable.$inferSelect;
export type FeastWindow = typeof feastWindowsTable.$inferSelect;
export type FeastWindowMember = typeof feastWindowMembersTable.$inferSelect;
export type Order = typeof ordersTable.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItemsTable.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type PushToken = typeof pushTokensTable.$inferSelect;
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type RestaurantStaff = typeof restaurantStaffTable.$inferSelect;
export type InsertRestaurantStaff = z.infer<typeof insertRestaurantStaffSchema>;

import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

// ---------------------------------------------------------------------------
// Delivery-address persistence tests
//
// POST /orders persists the delivery address (and optional map pin) so the
// tracking map can show the real destination — including when tracking is
// reopened from order history. These tests cover:
//   * delivery orders storing the trimmed address + lat/lng pin
//   * pickup orders storing null address/coords even if the client sends them
//   * address-only delivery orders (no pin) storing null coordinates
//   * GET /orders/:id and GET /orders/me returning the stored fields round-trip
//
// External dependencies (Postgres via @workspace/db, Stripe, pricing, push
// notifications, tracking broadcast) are mocked; the real route logic and the
// real `validateBody(placeOrderSchema)` guard stay in place. The db mock
// captures the exact values passed to the orders insert so we assert what is
// actually persisted, not just what the response echoes.
// ---------------------------------------------------------------------------

let selectRows: any[] = [];
let orderInsertValues: Record<string, unknown> | null = null;
let nextOrderId = 1;

function makeSelectChain() {
  const chain: any = {
    from: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => Promise.resolve(selectRows),
    limit: () => Promise.resolve(selectRows),
    then: (resolve: (v: unknown) => void) => resolve(selectRows),
  };
  return chain;
}

function makeUpdateChain() {
  const whereResult: any = {
    returning: () => Promise.resolve([]),
    // `await db.update(...).set(...).where(...)` (the lastPolledAt stamp)
    // resolves without a trailing `.returning()`.
    then: (resolve: (v: unknown) => void) => resolve(undefined),
  };
  const chain: any = {
    set: () => chain,
    where: () => whereResult,
  };
  return chain;
}

// Transaction mock: captures the orders insert values and returns a `created`
// row built from them (id + timestamps added) — mirroring what Postgres's
// `.returning()` would produce. The order_items bulk insert (array values)
// resolves silently.
function makeTx() {
  return {
    insert: () => ({
      values: (v: Record<string, unknown> | unknown[]) => {
        if (Array.isArray(v)) return Promise.resolve();
        orderInsertValues = v;
        const created = {
          id: nextOrderId++,
          statusManual: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...v,
        };
        return { returning: () => Promise.resolve([created]) };
      },
    }),
  };
}

vi.mock("@workspace/db", () => ({
  db: {
    select: () => makeSelectChain(),
    update: () => makeUpdateChain(),
    transaction: async (fn: (tx: unknown) => unknown) => fn(makeTx()),
  },
}));

const CUSTOMER_USER = { userId: 1, role: "customer" };
vi.mock("../middlewares/auth.js", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = CUSTOMER_USER;
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requireStaff: (req: any, _res: any, next: any) => {
    req.user = CUSTOMER_USER;
    next();
  },
}));

vi.mock("../lib/orderNotifications.js", () => ({
  notifyManualStatus: vi.fn(),
  scheduleOrderById: vi.fn(),
}));

vi.mock("../lib/orderTracking.js", () => ({
  broadcastOrderUpdate: vi.fn(),
}));

// Pricing is not under test — return a fixed server-side priced cart. The
// PaymentIntent mock below charges the same total so payment verification
// passes.
const TOTAL_CENTS = 2000;
vi.mock("../lib/pricing.js", () => ({
  normalizeRequestedItems: (items: unknown[]) => ({
    ok: true,
    items: (items as any[]).map((i) => ({
      menuItemId: i.menuItemId,
      quantity: i.quantity,
      specialInstructions: i.specialInstructions ?? null,
    })),
  }),
  priceOrder: async () => ({
    ok: true,
    priced: {
      lineItems: [
        { menuItemId: "m1", name: "Feast Bowl", price: 20, quantity: 1, specialInstructions: null },
      ],
      subtotalCents: TOTAL_CENTS,
      totalCents: TOTAL_CENTS,
    },
  }),
}));

const retrievePaymentIntent = vi.fn();
vi.mock("../lib/stripe.js", () => ({
  isTestMode: true,
  stripe: {
    paymentIntents: {
      retrieve: (...args: unknown[]) => retrievePaymentIntent(...args),
    },
    refunds: { create: vi.fn() },
  },
}));

// Import the router only after the mocks are registered.
const { default: router } = await import("./orders.js");

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.log = { error: () => {} };
    next();
  });
  app.use(router);
  return app;
}

function succeededPaymentIntent() {
  return {
    id: "pi_test_1",
    status: "succeeded",
    amount: TOTAL_CENTS,
    currency: "usd",
    metadata: { userId: String(CUSTOMER_USER.userId) },
    latest_charge: {
      payment_method_details: { card: { brand: "visa", last4: "4242" } },
    },
  };
}

function orderPayload(overrides: Record<string, unknown> = {}) {
  return {
    restaurantId: "r1",
    deliveryType: "delivery",
    items: [{ menuItemId: "m1", quantity: 1 }],
    paymentIntentId: "pi_test_1",
    ...overrides,
  };
}

function makeStoredOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    userId: CUSTOMER_USER.userId,
    restaurantId: "r1",
    restaurantName: "Testaurant",
    feastWindowId: null,
    deliveryType: "delivery",
    deliveryAddress: "500 Feast Ave, San Francisco, CA",
    // numeric columns come back from Postgres as strings
    deliveryLat: "37.7749",
    deliveryLng: "-122.4194",
    items: [],
    subtotal: "20.00",
    status: "delivered",
    statusManual: true,
    rating: null,
    ratingComment: null,
    ratedAt: null,
    createdAt: new Date("2026-07-01T12:00:00.000Z"),
    updatedAt: new Date("2026-07-01T12:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  selectRows = [];
  orderInsertValues = null;
  nextOrderId = 1;
  retrievePaymentIntent.mockReset();
  retrievePaymentIntent.mockResolvedValue(succeededPaymentIntent());
});

describe("POST /orders delivery address persistence", () => {
  it("persists deliveryAddress and deliveryLat/deliveryLng for a delivery order with a pin", async () => {
    const res = await request(makeApp())
      .post("/orders")
      .send(
        orderPayload({
          deliveryAddress: "500 Feast Ave, San Francisco, CA",
          deliveryLat: 37.7749,
          deliveryLng: -122.4194,
        }),
      );

    expect(res.status).toBe(201);
    expect(orderInsertValues).toMatchObject({
      deliveryAddress: "500 Feast Ave, San Francisco, CA",
      deliveryLat: "37.7749",
      deliveryLng: "-122.4194",
    });
    // The created order echoes the persisted fields back to the client.
    expect(res.body.deliveryAddress).toBe("500 Feast Ave, San Francisco, CA");
    expect(res.body.deliveryLat).toBe("37.7749");
    expect(res.body.deliveryLng).toBe("-122.4194");
  });

  it("trims surrounding whitespace from the delivery address before storing it", async () => {
    const res = await request(makeApp())
      .post("/orders")
      .send(
        orderPayload({
          deliveryAddress: "   12 Noodle St, Oakland, CA  \n",
          deliveryLat: 37.8044,
          deliveryLng: -122.2712,
        }),
      );

    expect(res.status).toBe(201);
    expect(orderInsertValues).toMatchObject({
      deliveryAddress: "12 Noodle St, Oakland, CA",
    });
  });

  it("stores a whitespace-only address as null", async () => {
    const res = await request(makeApp())
      .post("/orders")
      .send(orderPayload({ deliveryAddress: "   " }));

    expect(res.status).toBe(201);
    expect(orderInsertValues).toMatchObject({
      deliveryAddress: null,
      deliveryLat: null,
      deliveryLng: null,
    });
  });

  it("stores null address and coordinates for a pickup order even if the client sends them", async () => {
    const res = await request(makeApp())
      .post("/orders")
      .send(
        orderPayload({
          deliveryType: "pickup",
          deliveryAddress: "500 Feast Ave, San Francisco, CA",
          deliveryLat: 37.7749,
          deliveryLng: -122.4194,
        }),
      );

    expect(res.status).toBe(201);
    expect(orderInsertValues).toMatchObject({
      deliveryType: "pickup",
      deliveryAddress: null,
      deliveryLat: null,
      deliveryLng: null,
    });
    expect(res.body.deliveryAddress).toBeNull();
    expect(res.body.deliveryLat).toBeNull();
    expect(res.body.deliveryLng).toBeNull();
  });

  it("stores the address with null coordinates for an address-only delivery order (no pin)", async () => {
    const res = await request(makeApp())
      .post("/orders")
      .send(orderPayload({ deliveryAddress: "77 Curry Ln, Berkeley, CA" }));

    expect(res.status).toBe(201);
    expect(orderInsertValues).toMatchObject({
      deliveryAddress: "77 Curry Ln, Berkeley, CA",
      deliveryLat: null,
      deliveryLng: null,
    });
    expect(res.body.deliveryAddress).toBe("77 Curry Ln, Berkeley, CA");
    expect(res.body.deliveryLat).toBeNull();
    expect(res.body.deliveryLng).toBeNull();
  });

  it("stores null coordinates when only one of lat/lng accompanies a partial pin value that is not a number", async () => {
    const res = await request(makeApp())
      .post("/orders")
      .send(
        orderPayload({
          deliveryAddress: "9 Dumpling Way, Daly City, CA",
          deliveryLat: 37.6879,
          deliveryLng: null,
        }),
      );

    expect(res.status).toBe(201);
    expect(orderInsertValues).toMatchObject({
      deliveryAddress: "9 Dumpling Way, Daly City, CA",
      deliveryLat: "37.6879",
      deliveryLng: null,
    });
  });
});

describe("GET /orders/:id delivery address round-trip", () => {
  it("returns the stored deliveryAddress and coordinates", async () => {
    selectRows = [makeStoredOrder()];

    const res = await request(makeApp()).get("/orders/1");

    expect(res.status).toBe(200);
    expect(res.body.deliveryAddress).toBe("500 Feast Ave, San Francisco, CA");
    expect(res.body.deliveryLat).toBe("37.7749");
    expect(res.body.deliveryLng).toBe("-122.4194");
  });

  it("returns null address fields for a stored pickup order", async () => {
    selectRows = [
      makeStoredOrder({
        deliveryType: "pickup",
        deliveryAddress: null,
        deliveryLat: null,
        deliveryLng: null,
      }),
    ];

    const res = await request(makeApp()).get("/orders/1");

    expect(res.status).toBe(200);
    expect(res.body.deliveryAddress).toBeNull();
    expect(res.body.deliveryLat).toBeNull();
    expect(res.body.deliveryLng).toBeNull();
  });
});

describe("GET /orders/me delivery address round-trip", () => {
  it("returns the stored address fields for each order in history", async () => {
    selectRows = [
      makeStoredOrder({ id: 1 }),
      makeStoredOrder({
        id: 2,
        deliveryAddress: "77 Curry Ln, Berkeley, CA",
        deliveryLat: null,
        deliveryLng: null,
      }),
      makeStoredOrder({
        id: 3,
        deliveryType: "pickup",
        deliveryAddress: null,
        deliveryLat: null,
        deliveryLng: null,
      }),
    ];

    const res = await request(makeApp()).get("/orders/me");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);

    expect(res.body[0].deliveryAddress).toBe("500 Feast Ave, San Francisco, CA");
    expect(res.body[0].deliveryLat).toBe("37.7749");
    expect(res.body[0].deliveryLng).toBe("-122.4194");

    // Address-only order: address survives, pin stays null.
    expect(res.body[1].deliveryAddress).toBe("77 Curry Ln, Berkeley, CA");
    expect(res.body[1].deliveryLat).toBeNull();
    expect(res.body[1].deliveryLng).toBeNull();

    // Pickup order: everything null.
    expect(res.body[2].deliveryAddress).toBeNull();
    expect(res.body[2].deliveryLat).toBeNull();
    expect(res.body[2].deliveryLng).toBeNull();
  });
});

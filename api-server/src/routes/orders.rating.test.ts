import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

// ---------------------------------------------------------------------------
// Mocks
//
// The rating route talks to Postgres (via `@workspace/db`) to look up the order,
// persist the rating, and recompute the restaurant's displayed average. It also
// imports the Stripe client / pricing helpers and the notification + tracking
// modules at module load (shared with the other order routes), which connect to
// external services and throw without env vars. We mock all of these so the test
// exercises the real rating logic end to end through the HTTP layer, while the
// real `validateBody(rateOrderSchema)` guard stays in place (NOT mocked) so the
// 1-5 validation behavior is genuinely covered.
//
//   * `db.select(...)` chains resolve to `selectRows` when `.limit()` is called
//     (the order lookup) and to `aggRows` when the chain is awaited directly via
//     `.where()` (the rating aggregate in recomputeRestaurantRating).
//   * `db.update(...).set(values)` records `values` into `setCalls` so we can
//     assert exactly what was written. `.returning()` resolves to
//     `updateReturning` (the updated order); awaiting `.where()` on its own
//     resolves undefined (the fire-and-forget restaurant rating write).
//   * `requireAuth` injects a fake customer user — ownership is asserted via the
//     userId match in the route.
// ---------------------------------------------------------------------------

let selectRows: any[] = [];
let aggRows: any[] = [];
let updateReturning: any[] = [];
let setCalls: Record<string, unknown>[] = [];

function makeSelectChain() {
  const chain: any = {
    from: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => Promise.resolve(selectRows),
    limit: () => Promise.resolve(selectRows),
    // The rating aggregate awaits `db.select(...).from().where()` directly with
    // no `.limit()`, so make the chain itself thenable to resolve `aggRows`.
    then: (resolve: (v: unknown) => void) => resolve(aggRows),
  };
  return chain;
}

function makeUpdateChain() {
  const whereResult: any = {
    returning: () => Promise.resolve(updateReturning),
    // `await db.update(...).set(...).where(...)` (the restaurant rating write)
    // resolves without a trailing `.returning()`.
    then: (resolve: (v: unknown) => void) => resolve(undefined),
  };
  const chain: any = {
    set: (values: Record<string, unknown>) => {
      setCalls.push(values);
      return chain;
    },
    where: () => whereResult,
  };
  return chain;
}

vi.mock("@workspace/db", () => ({
  db: {
    select: () => makeSelectChain(),
    update: () => makeUpdateChain(),
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

const notifyManualStatus = vi.fn();
const scheduleOrderById = vi.fn();
vi.mock("../lib/orderNotifications.js", () => ({
  notifyManualStatus: (...args: unknown[]) => notifyManualStatus(...args),
  scheduleOrderById: (...args: unknown[]) => scheduleOrderById(...args),
}));

const broadcastOrderUpdate = vi.fn();
vi.mock("../lib/orderTracking.js", () => ({
  broadcastOrderUpdate: (...args: unknown[]) => broadcastOrderUpdate(...args),
}));

// Imported at module load but never reached by the rating route; stub so the
// real modules (which connect to Stripe / require env) never load.
vi.mock("../lib/stripe.js", () => ({ stripe: {}, isTestMode: true }));
vi.mock("../lib/pricing.js", () => ({
  priceOrder: vi.fn(),
  normalizeRequestedItems: vi.fn(),
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

type OrderOverrides = Partial<{
  id: number;
  userId: number;
  restaurantId: string;
  status: string;
  rating: number | null;
  ratingComment: string | null;
  ratedAt: Date | null;
}>;

function makeOrder(overrides: OrderOverrides = {}) {
  return {
    id: 1,
    userId: CUSTOMER_USER.userId,
    restaurantId: "r1",
    feastWindowId: null,
    deliveryType: "delivery",
    items: [],
    subtotal: "10.00",
    status: "delivered",
    statusManual: true,
    rating: null,
    ratingComment: null,
    ratedAt: null,
    createdAt: new Date("2026-06-19T12:00:00.000Z"),
    updatedAt: new Date("2026-06-19T12:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  selectRows = [];
  aggRows = [];
  updateReturning = [];
  setCalls = [];
  notifyManualStatus.mockClear();
  scheduleOrderById.mockClear();
  broadcastOrderUpdate.mockClear();
});

describe("POST /orders/:id/rating", () => {
  it("persists a valid 1-5 rating and returns the saved rating fields", async () => {
    selectRows = [makeOrder()];
    aggRows = [{ avg: "4.0", count: 1 }];
    updateReturning = [
      makeOrder({ rating: 4, ratingComment: "Great food", ratedAt: new Date() }),
    ];

    const res = await request(makeApp())
      .post("/orders/1/rating")
      .send({ rating: 4, comment: "Great food" });

    // A first-time rating (order.rating was null) is created → 201.
    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(4);
    expect(res.body.ratingComment).toBe("Great food");
    expect(res.body.ratedAt).toBeTruthy();

    // The persisted write stamps the rating, comment, and ratedAt timestamp.
    const ratingWrite = setCalls.find((c) => "rating" in c);
    expect(ratingWrite).toMatchObject({ rating: 4, ratingComment: "Great food" });
    expect(ratingWrite).toHaveProperty("ratedAt");
  });

  it("accepts the boundary ratings 1 and 5", async () => {
    for (const value of [1, 5]) {
      selectRows = [makeOrder()];
      aggRows = [{ avg: String(value), count: 1 }];
      updateReturning = [makeOrder({ rating: value, ratedAt: new Date() })];

      const res = await request(makeApp())
        .post("/orders/1/rating")
        .send({ rating: value });

      expect(res.status).toBe(201);
      expect(res.body.rating).toBe(value);
    }
  });

  it("stores a blank comment as null", async () => {
    selectRows = [makeOrder()];
    aggRows = [{ avg: "3.0", count: 1 }];
    updateReturning = [makeOrder({ rating: 3, ratingComment: null, ratedAt: new Date() })];

    const res = await request(makeApp())
      .post("/orders/1/rating")
      .send({ rating: 3, comment: "   " });

    expect(res.status).toBe(201);
    const ratingWrite = setCalls.find((c) => "rating" in c);
    expect(ratingWrite).toMatchObject({ rating: 3, ratingComment: null });
  });

  it.each([0, 6, -1, 2.5])(
    "rejects the out-of-range/non-integer rating %p with 400 and writes nothing",
    async (value) => {
      selectRows = [makeOrder()];

      const res = await request(makeApp())
        .post("/orders/1/rating")
        .send({ rating: value });

      expect(res.status).toBe(400);
      // No rating was persisted.
      expect(setCalls.some((c) => "rating" in c)).toBe(false);
    },
  );

  it("rejects a missing rating with 400", async () => {
    selectRows = [makeOrder()];

    const res = await request(makeApp()).post("/orders/1/rating").send({});

    expect(res.status).toBe(400);
    expect(setCalls.some((c) => "rating" in c)).toBe(false);
  });

  it("returns 404 when the order does not exist", async () => {
    selectRows = [];

    const res = await request(makeApp())
      .post("/orders/1/rating")
      .send({ rating: 5 });

    expect(res.status).toBe(404);
    expect(setCalls.some((c) => "rating" in c)).toBe(false);
  });

  it("returns 403 when rating an order owned by another user", async () => {
    selectRows = [makeOrder({ userId: 999 })];

    const res = await request(makeApp())
      .post("/orders/1/rating")
      .send({ rating: 5 });

    expect(res.status).toBe(403);
    expect(setCalls.some((c) => "rating" in c)).toBe(false);
  });
});

describe("GET /orders/me", () => {
  it("returns the saved rating fields for a rated order", async () => {
    const ratedAt = new Date("2026-06-19T13:00:00.000Z");
    selectRows = [
      makeOrder({ rating: 5, ratingComment: "Perfect", ratedAt }),
    ];

    const res = await request(makeApp()).get("/orders/me");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].rating).toBe(5);
    expect(res.body[0].ratingComment).toBe("Perfect");
    expect(res.body[0].ratedAt).toBe(ratedAt.toISOString());
  });

  it("returns null rating fields for an unrated order", async () => {
    selectRows = [makeOrder({ rating: null, ratingComment: null, ratedAt: null })];

    const res = await request(makeApp()).get("/orders/me");

    expect(res.status).toBe(200);
    expect(res.body[0].rating).toBeNull();
    expect(res.body[0].ratingComment).toBeNull();
    expect(res.body[0].ratedAt).toBeNull();
  });
});

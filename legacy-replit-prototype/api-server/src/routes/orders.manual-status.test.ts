import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

// ---------------------------------------------------------------------------
// Mocks
//
// The order-status routes talk to Postgres (via `@workspace/db`), the customer
// notification scheduler (`../lib/orderNotifications.js`), and the WebSocket
// tracking broadcaster (`../lib/orderTracking.js`). They also import the Stripe
// client and pricing helpers at module load, which connect to external services
// and throw without env vars. We mock all of these so the tests run in isolation
// and exercise the real status logic (orderStatus.js is left unmocked) end to
// end through the HTTP layer.
//
//   * `db.select(...)` chains resolve to `selectRows` (the fetched order).
//   * `db.update(...).set(values)` records `values` into `setCalls` so we can
//     assert exactly what was written, and `.returning()` resolves to
//     `updateReturning` (the updated order). `.where()` is also awaitable on its
//     own for the fire-and-forget lastPolledAt write in GET.
//   * `requireAuth`/`requireRole`/`requireStaff` are pass-throughs that inject a
//     fake staff user — authorization itself is covered elsewhere; here we focus
//     on the status-precedence behavior.
//   * `notifyManualStatus` and `broadcastOrderUpdate` are spies so we can assert
//     the customer push + live-tracking broadcast fire on a manual change.
// ---------------------------------------------------------------------------

let selectRows: any[] = [];
let updateReturning: any[] = [];
let setCalls: Record<string, unknown>[] = [];

function makeSelectChain() {
  const chain: any = {
    from: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => Promise.resolve(selectRows),
    limit: () => Promise.resolve(selectRows),
  };
  return chain;
}

function makeUpdateChain() {
  const whereResult: any = {
    returning: () => Promise.resolve(updateReturning),
    // Make `await db.update(...).set(...).where(...)` (the lastPolledAt write in
    // GET) resolve without a trailing `.returning()`.
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

const STAFF_USER = { userId: 1, role: "restaurant_staff" };
vi.mock("../middlewares/auth.js", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = STAFF_USER;
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requireStaff: (req: any, _res: any, next: any) => {
    req.user = STAFF_USER;
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

// Imported at module load but never reached by the status routes; stub so the
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
  // pino-http normally attaches req.log; provide a no-op so the routes' error
  // logging never throws if a catch branch is hit.
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
  status: string;
  statusManual: boolean;
  createdAt: Date;
}>;

function makeOrder(overrides: OrderOverrides = {}) {
  return {
    id: 1,
    userId: STAFF_USER.userId,
    restaurantId: "r1",
    feastWindowId: null,
    deliveryType: "delivery",
    items: [],
    subtotal: "10.00",
    status: "confirmed",
    statusManual: false,
    rating: null,
    createdAt: new Date("2026-06-19T12:00:00.000Z"),
    updatedAt: new Date("2026-06-19T12:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  selectRows = [];
  updateReturning = [];
  setCalls = [];
  notifyManualStatus.mockClear();
  scheduleOrderById.mockClear();
  broadcastOrderUpdate.mockClear();
});

describe("PATCH /orders/:id/status", () => {
  it("sets the explicit status and marks the order manually controlled", async () => {
    selectRows = [makeOrder({ status: "confirmed", statusManual: false })];
    updateReturning = [makeOrder({ status: "preparing", statusManual: true })];

    const res = await request(makeApp())
      .patch("/orders/1/status")
      .send({ status: "preparing" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("preparing");
    expect(res.body.statusManual).toBe(true);

    // The DB write must stamp both the new status and statusManual=true so the
    // time-based simulation stops overriding it.
    const statusWrite = setCalls.find((c) => "status" in c);
    expect(statusWrite).toMatchObject({ status: "preparing", statusManual: true });

    // The customer push + live-tracking broadcast fire for the manual change.
    expect(notifyManualStatus).toHaveBeenCalledWith(1, "preparing");
    expect(broadcastOrderUpdate).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid status with 400 and writes nothing", async () => {
    selectRows = [makeOrder()];

    const res = await request(makeApp())
      .patch("/orders/1/status")
      .send({ status: "bogus" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid status");
    // No status was persisted and no customer was notified.
    expect(setCalls).toHaveLength(0);
    expect(notifyManualStatus).not.toHaveBeenCalled();
    expect(broadcastOrderUpdate).not.toHaveBeenCalled();
  });

  it("returns status-based driverProgress/etaMinutes for a manual order", async () => {
    selectRows = [makeOrder({ status: "preparing", statusManual: true })];
    updateReturning = [makeOrder({ status: "on_the_way", statusManual: true })];

    const res = await request(makeApp())
      .patch("/orders/1/status")
      .send({ status: "on_the_way" });

    expect(res.status).toBe(200);
    // on_the_way maps to a representative mid-route position and a 10-minute ETA
    // (derived from the staff-set status, NOT elapsed time).
    expect(res.body.driverProgress).toBe(0.5);
    expect(res.body.etaMinutes).toBe(10);
  });

  it("reports delivered as arrived (progress 1, eta 0)", async () => {
    selectRows = [makeOrder({ status: "on_the_way", statusManual: true })];
    updateReturning = [makeOrder({ status: "delivered", statusManual: true })];

    const res = await request(makeApp())
      .patch("/orders/1/status")
      .send({ status: "delivered" });

    expect(res.status).toBe(200);
    expect(res.body.driverProgress).toBe(1);
    expect(res.body.etaMinutes).toBe(0);
  });
});

describe("POST /orders/:id/advance", () => {
  it("advances to the next status and marks the order manually controlled", async () => {
    selectRows = [makeOrder({ status: "confirmed", statusManual: false })];
    updateReturning = [makeOrder({ status: "preparing", statusManual: true })];

    const res = await request(makeApp()).post("/orders/1/advance").send();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("preparing");
    expect(res.body.statusManual).toBe(true);

    const statusWrite = setCalls.find((c) => "status" in c);
    expect(statusWrite).toMatchObject({ status: "preparing", statusManual: true });
    expect(notifyManualStatus).toHaveBeenCalledWith(1, "preparing");
    expect(broadcastOrderUpdate).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when advancing past the final delivered status", async () => {
    selectRows = [makeOrder({ status: "delivered", statusManual: true })];

    const res = await request(makeApp()).post("/orders/1/advance").send();

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Order is already at the final status");
    // Nothing changes and no customer is notified.
    expect(setCalls).toHaveLength(0);
    expect(notifyManualStatus).not.toHaveBeenCalled();
    expect(broadcastOrderUpdate).not.toHaveBeenCalled();
  });
});

describe("GET /orders/:id status-precedence", () => {
  it("does not overwrite a manually-set status that the time-based sim would advance", async () => {
    // createdAt is far in the past, so the elapsed-time simulation would derive
    // "delivered"; because statusManual is true, syncOrderStatus must leave the
    // staff-set "preparing" untouched.
    selectRows = [
      makeOrder({
        status: "preparing",
        statusManual: true,
        createdAt: new Date("2020-01-01T00:00:00.000Z"),
      }),
    ];

    const res = await request(makeApp()).get("/orders/1");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("preparing");
    // The only DB write is the lastPolledAt presence stamp — never a status
    // change for a manual order.
    expect(setCalls.some((c) => "lastPolledAt" in c)).toBe(true);
    expect(setCalls.every((c) => !("status" in c))).toBe(true);
    // Tracking is derived from the staff-set status, not elapsed time.
    expect(res.body.driverProgress).toBe(0);
    expect(res.body.etaMinutes).toBe(30);
  });
});

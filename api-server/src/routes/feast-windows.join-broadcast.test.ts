import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

// ---------------------------------------------------------------------------
// Mocks
//
// The join handler talks to Postgres (via `@workspace/db`) and the WebSocket
// broadcaster (via `../lib/ws`). We mock both so the test runs in isolation and
// can drive the handler down specific branches:
//
//   * `db.transaction(cb)` is replaced with a stub that ignores the real query
//     callback and resolves to whatever result the current test sets. This lets
//     us simulate the post-join state of a feast window (spotsFilled, etc.)
//     without a database, while still exercising the handler's real broadcast
//     logic that runs after the transaction.
//   * `broadcast` is a spy so we can assert exactly which WS events fire.
//   * `requireAuth` is a pass-through that injects a fake user.
// ---------------------------------------------------------------------------

let transactionResult: unknown;

vi.mock("@workspace/db", () => ({
  db: {
    transaction: vi.fn(async () => transactionResult),
  },
}));

const broadcast = vi.fn();
vi.mock("../lib/ws", () => ({
  broadcast: (msg: object) => broadcast(msg),
}));

vi.mock("../middlewares/auth.js", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { userId: "test-user" };
    next();
  },
}));

// Import the router only after mocks are registered.
const { default: router } = await import("./feast-windows");

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

type WindowState = {
  id: string;
  spotsTotal: number;
  spotsFilled: number;
  discount: number;
};

/**
 * Drive the join handler as if a single join had just succeeded and left the
 * window in `state`, then return the broadcast events that fired.
 */
async function joinResultingIn(state: WindowState): Promise<Array<{ type: string; [k: string]: unknown }>> {
  transactionResult = { status: 200, updated: state };
  broadcast.mockClear();
  const res = await request(makeApp()).post(`/feast-windows/${state.id}/join`).send();
  expect(res.status).toBe(200);
  return broadcast.mock.calls.map((c) => c[0] as { type: string });
}

function eventsOfType(events: Array<{ type: string }>, type: string) {
  return events.filter((e) => e.type === type);
}

describe("join handler discount-unlock broadcast", () => {
  beforeEach(() => {
    transactionResult = undefined;
    broadcast.mockClear();
  });

  it("emits exactly one discount_unlocked on the join that crosses ceil(spotsTotal/2)", async () => {
    // spotsTotal=6 -> threshold ceil(6/2)=3. Going from 2 -> 3 crosses it.
    const events = await joinResultingIn({ id: "w1", spotsTotal: 6, spotsFilled: 3, discount: 25 });

    const unlocks = eventsOfType(events, "feast_window_discount_unlocked");
    expect(unlocks).toHaveLength(1);
    expect(unlocks[0]).toEqual({ type: "feast_window_discount_unlocked", id: "w1", discount: 25 });
    // The window is not full, so no full event.
    expect(eventsOfType(events, "feast_window_full")).toHaveLength(0);
    // The generic update always fires.
    expect(eventsOfType(events, "feast_window_update")).toHaveLength(1);
  });

  it("crosses correctly for an odd spotsTotal (ceil rounds up)", async () => {
    // spotsTotal=5 -> threshold ceil(5/2)=3. Going from 2 -> 3 crosses it.
    const events = await joinResultingIn({ id: "w-odd", spotsTotal: 5, spotsFilled: 3, discount: 10 });
    expect(eventsOfType(events, "feast_window_discount_unlocked")).toHaveLength(1);
  });

  it("emits no discount_unlocked on a join that does not reach the threshold", async () => {
    // spotsTotal=6 -> threshold 3. Going from 1 -> 2 does not reach it.
    const events = await joinResultingIn({ id: "w2", spotsTotal: 6, spotsFilled: 2, discount: 25 });

    expect(eventsOfType(events, "feast_window_discount_unlocked")).toHaveLength(0);
    expect(eventsOfType(events, "feast_window_full")).toHaveLength(0);
    expect(eventsOfType(events, "feast_window_update")).toHaveLength(1);
  });

  it("does not re-fire discount_unlocked on joins past the threshold", async () => {
    // Threshold already crossed previously; subsequent joins must stay silent.
    const fourth = await joinResultingIn({ id: "w3", spotsTotal: 6, spotsFilled: 4, discount: 25 });
    expect(eventsOfType(fourth, "feast_window_discount_unlocked")).toHaveLength(0);

    const fifth = await joinResultingIn({ id: "w3", spotsTotal: 6, spotsFilled: 5, discount: 25 });
    expect(eventsOfType(fifth, "feast_window_discount_unlocked")).toHaveLength(0);
  });

  it("emits feast_window_full and NOT discount_unlocked on the join that fills the window", async () => {
    // spotsTotal=6, filling to 6. Even though 6 >= threshold 3, the full branch
    // takes over and the unlock event is suppressed.
    const events = await joinResultingIn({ id: "w4", spotsTotal: 6, spotsFilled: 6, discount: 25 });

    expect(eventsOfType(events, "feast_window_full")).toHaveLength(1);
    expect(eventsOfType(events, "feast_window_full")[0]).toEqual({ type: "feast_window_full", id: "w4" });
    expect(eventsOfType(events, "feast_window_discount_unlocked")).toHaveLength(0);
    expect(eventsOfType(events, "feast_window_update")).toHaveLength(1);
  });

  it("suppresses the unlock even when the threshold and the fill happen on the same join", async () => {
    // A tiny window of 2 spots: threshold ceil(2/2)=1. Filling 1 -> 2 both fills
    // it and would otherwise cross the threshold; full must win.
    const events = await joinResultingIn({ id: "w5", spotsTotal: 2, spotsFilled: 2, discount: 15 });

    expect(eventsOfType(events, "feast_window_full")).toHaveLength(1);
    expect(eventsOfType(events, "feast_window_discount_unlocked")).toHaveLength(0);
  });

  it("does not broadcast unlock/full events when the join is rejected", async () => {
    transactionResult = { status: 409, error: "This feast window is full" };
    broadcast.mockClear();

    const res = await request(makeApp()).post("/feast-windows/w6/join").send();

    expect(res.status).toBe(409);
    expect(broadcast).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
//
// expiry.ts talks to Postgres (via `@workspace/db`) to find still-active feast
// windows and to the WebSocket broadcaster (via `./ws`) to announce expiry. We
// mock both so the test runs in isolation:
//
//   * `db.select().from().where()` is stubbed to resolve to whatever set of
//     active windows the current test declares. The real query filters to
//     `endTime > now`, so `activeRows` models exactly the rows the DB would
//     return on a given tick.
//   * `broadcast` is a spy so we can assert precisely which WS events fire.
//
// The scheduler arms real `setTimeout`s, so every test drives time with
// vitest's fake timers to fire (or withhold) the expiry callbacks
// deterministically.
// ---------------------------------------------------------------------------

let activeRows: Array<{ id: string; endTime: number }> = [];
// When set, the next (and every subsequent) query rejects with this error,
// modelling a transient DB outage. Tests clear it to "restore" the database.
let queryError: Error | null = null;

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => {
          if (queryError) throw queryError;
          return activeRows;
        },
      }),
    }),
  },
}));

const broadcast = vi.fn();
vi.mock("./ws", () => ({
  broadcast: (msg: object) => broadcast(msg),
}));

const logError = vi.fn();
vi.mock("./logger", () => ({
  logger: {
    error: (...args: unknown[]) => logError(...args),
  },
}));

// Import only after the mocks are registered.
const { scheduleExpiryBroadcasts } = await import("./expiry.js");

const NOW = 1_000_000_000;

function eventsOfType(type: string) {
  return broadcast.mock.calls
    .map((c) => c[0] as { type: string; id?: string })
    .filter((e) => e.type === type);
}

describe("scheduled feast-window expiry broadcast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    activeRows = [];
    queryError = null;
    broadcast.mockClear();
    logError.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits exactly one feast_window_expired when a window passes its endTime", async () => {
    activeRows = [{ id: "exp-1", endTime: NOW + 1_000 }];

    await scheduleExpiryBroadcasts();
    // Nothing fires until the endTime is reached.
    expect(eventsOfType("feast_window_expired")).toHaveLength(0);

    vi.advanceTimersByTime(1_000);

    const expired = eventsOfType("feast_window_expired");
    expect(expired).toHaveLength(1);
    expect(expired[0]).toEqual({ type: "feast_window_expired", id: "exp-1" });
  });

  it("does not re-broadcast on subsequent ticks after a window already expired", async () => {
    activeRows = [{ id: "exp-2", endTime: NOW + 1_000 }];

    await scheduleExpiryBroadcasts();
    vi.advanceTimersByTime(1_000);
    expect(eventsOfType("feast_window_expired")).toHaveLength(1);

    // Time marches on and the scheduler ticks again. The window is now past its
    // endTime, so the real `endTime > now` query no longer returns it.
    vi.setSystemTime(NOW + 2_000);
    activeRows = [];
    await scheduleExpiryBroadcasts();
    vi.advanceTimersByTime(60_000);

    // Still exactly one expiry, never a duplicate.
    expect(eventsOfType("feast_window_expired")).toHaveLength(1);
  });

  it("schedules a window only once across repeated ticks before it expires", async () => {
    // Two scheduler ticks land within the same active window (e.g. the startup
    // call plus a 60s interval tick) before the window's endTime.
    activeRows = [{ id: "exp-3", endTime: NOW + 90_000 }];

    await scheduleExpiryBroadcasts();
    // Move the clock forward 60s (without reaching the 90s endTime) and tick
    // again, as the startup call + interval tick would.
    vi.advanceTimersByTime(60_000);
    await scheduleExpiryBroadcasts();

    // The window is still active, so nothing has fired yet.
    expect(eventsOfType("feast_window_expired")).toHaveLength(0);

    vi.advanceTimersByTime(30_000);

    // Despite two ticks arming the schedule, the expiry announces exactly once.
    const expired = eventsOfType("feast_window_expired");
    expect(expired).toHaveLength(1);
    expect(expired[0]).toEqual({ type: "feast_window_expired", id: "exp-3" });
  });

  it("expires each active window independently with its own single broadcast", async () => {
    activeRows = [
      { id: "multi-a", endTime: NOW + 1_000 },
      { id: "multi-b", endTime: NOW + 5_000 },
    ];

    await scheduleExpiryBroadcasts();

    vi.advanceTimersByTime(1_000);
    expect(eventsOfType("feast_window_expired").map((e) => e.id)).toEqual(["multi-a"]);

    vi.advanceTimersByTime(4_000);
    expect(eventsOfType("feast_window_expired").map((e) => e.id)).toEqual([
      "multi-a",
      "multi-b",
    ]);
  });

  it("only ever emits feast_window_expired — never feast_window_full or other events", async () => {
    // A window can be full yet still un-expired: the join handler owns
    // feast_window_full, while the scheduler owns expiry. The two must never
    // cross wires, so the scheduler emits nothing but feast_window_expired.
    activeRows = [{ id: "full-but-live", endTime: NOW + 1_000 }];

    await scheduleExpiryBroadcasts();
    vi.advanceTimersByTime(1_000);

    expect(eventsOfType("feast_window_full")).toHaveLength(0);
    expect(eventsOfType("feast_window_update")).toHaveLength(0);
    expect(eventsOfType("feast_window_discount_unlocked")).toHaveLength(0);
    expect(eventsOfType("feast_window_expired")).toHaveLength(1);
    // And that expiry event is the ONLY broadcast the scheduler made.
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it("swallows a failing query tick: no broadcast, no unhandled rejection, error logged", async () => {
    queryError = new Error("connection refused");

    // The promise must resolve (not reject) even though the DB query threw.
    await expect(scheduleExpiryBroadcasts()).resolves.toBeUndefined();

    // The failed tick schedules nothing and broadcasts nothing, even as time
    // passes well beyond any plausible endTime.
    vi.advanceTimersByTime(120_000);
    expect(broadcast).not.toHaveBeenCalled();

    // The failure is logged with the underlying error attached.
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      { err: queryError },
      "expiry schedule query error",
    );
  });

  it("recovers on the next tick after a DB hiccup and fires the missed window exactly once", async () => {
    // Tick 1: the DB is down. The window exists but the scheduler cannot see it.
    activeRows = [{ id: "recover-1", endTime: NOW + 90_000 }];
    queryError = new Error("transient outage");

    await scheduleExpiryBroadcasts();
    expect(broadcast).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledTimes(1);

    // Tick 2 (the 60s interval tick): the DB is back and the window is still
    // active, so the scheduler picks it up now.
    vi.advanceTimersByTime(60_000);
    queryError = null;
    await scheduleExpiryBroadcasts();

    // Not expired yet — the window still has 30s to run.
    expect(eventsOfType("feast_window_expired")).toHaveLength(0);

    vi.advanceTimersByTime(30_000);

    // The previously-missed window fires exactly once.
    const expired = eventsOfType("feast_window_expired");
    expect(expired).toHaveLength(1);
    expect(expired[0]).toEqual({ type: "feast_window_expired", id: "recover-1" });

    // No further duplicates on later ticks: the window is now in the past, so
    // the real `endTime > now` query would no longer return it.
    activeRows = [];
    await scheduleExpiryBroadcasts();
    vi.advanceTimersByTime(600_000);
    expect(eventsOfType("feast_window_expired")).toHaveLength(1);

    // Exactly one error was ever logged — the recovery tick logged nothing.
    expect(logError).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
//
// orderNotifications.ts imports `@workspace/db` (which connects to Postgres at
// import time) and `./push` (which talks to Expo). We only want to exercise the
// pure `shouldPush` decision here, so both are stubbed out to keep the module
// import side-effect free.
// ---------------------------------------------------------------------------

vi.mock("@workspace/db", () => ({ db: {} }));
vi.mock("./push", () => ({ sendPushToUser: vi.fn() }));

const { shouldPush, ACTIVE_WINDOW_MS, MAX_CATCHUP_AGE_MS } = await import(
  "./orderNotifications.js"
);

// A fixed "now" keeps every case deterministic; activation/poll times are
// expressed relative to it.
const NOW = 1_000_000_000;

describe("shouldPush", () => {
  it("pushes when the app is closed (never polled) and the transition is fresh", () => {
    // No poll signal at all -> the app missed the transition while closed.
    expect(shouldPush(NOW, NOW, null)).toBe(true);
  });

  it("suppresses when the tracking screen polled within the active window", () => {
    // Polled 1s ago (< 12s) -> app is open and shows the in-app notification.
    const lastPolledMs = NOW - 1_000;
    expect(shouldPush(NOW, NOW, lastPolledMs)).toBe(false);
  });

  it("treats a poll exactly at the active-window boundary as still active", () => {
    const lastPolledMs = NOW - ACTIVE_WINDOW_MS;
    expect(shouldPush(NOW, NOW, lastPolledMs)).toBe(false);
  });

  it("suppresses when the transition happened at/before the last poll", () => {
    // App was alive (polled) after the transition activated, so it already saw
    // it before going away. Poll is older than the active window to isolate this
    // branch from the active-app check.
    const activationMs = NOW - 60_000;
    const lastPolledMs = NOW - 30_000;
    expect(shouldPush(activationMs, NOW, lastPolledMs)).toBe(false);
  });

  it("pushes when the transition happened after the last poll (app missed it)", () => {
    // Last poll was before the transition activated and outside the active
    // window -> the app went away, then the status advanced -> push.
    const lastPolledMs = NOW - 60_000;
    const activationMs = NOW - 30_000;
    expect(shouldPush(activationMs, NOW, lastPolledMs)).toBe(true);
  });

  it("skips a stale transition older than the catch-up age, even with no poll", () => {
    // Activated > 5 min ago -> too old to be worth pushing (e.g. seed/historical
    // orders or a long outage).
    const activationMs = NOW - (MAX_CATCHUP_AGE_MS + 1);
    expect(shouldPush(activationMs, NOW, null)).toBe(false);
  });

  it("still pushes a transition exactly at the catch-up age boundary", () => {
    const activationMs = NOW - MAX_CATCHUP_AGE_MS;
    expect(shouldPush(activationMs, NOW, null)).toBe(true);
  });

  it("lets the stale check win over an old poll that would otherwise allow a push", () => {
    // Transition is stale AND happened after the last poll: the catch-up age
    // guard runs first and suppresses regardless.
    const activationMs = NOW - (MAX_CATCHUP_AGE_MS + 10_000);
    const lastPolledMs = activationMs - 1_000;
    expect(shouldPush(activationMs, NOW, lastPolledMs)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  OFFSETS_MS,
  deriveOrderStatus,
  deriveDriverProgress,
  deriveEtaMinutes,
} from "./orderStatus.js";

// These helpers derive the live-tracking driver position and ETA purely from the
// order's createdAt timestamp, so they must stay deterministic across screen
// reloads and server restarts. The tests pass an explicit `now` (rather than
// relying on Date.now()) so the elapsed-time math is fully controlled.

const createdAt = new Date(0);
const at = (ms: number) => createdAt.getTime() + ms;

describe("deriveOrderStatus", () => {
  it("starts at confirmed before any time has elapsed", () => {
    expect(deriveOrderStatus(createdAt, at(0))).toBe("confirmed");
  });

  it("returns the correct status at each elapsed-time boundary", () => {
    // Exactly at an offset, that status becomes active.
    expect(deriveOrderStatus(createdAt, at(OFFSETS_MS.confirmed))).toBe("confirmed");
    expect(deriveOrderStatus(createdAt, at(OFFSETS_MS.preparing))).toBe("preparing");
    expect(deriveOrderStatus(createdAt, at(OFFSETS_MS.driver_assigned))).toBe(
      "driver_assigned",
    );
    expect(deriveOrderStatus(createdAt, at(OFFSETS_MS.on_the_way))).toBe("on_the_way");
    expect(deriveOrderStatus(createdAt, at(OFFSETS_MS.delivered))).toBe("delivered");
  });

  it("holds the previous status just before the next boundary", () => {
    expect(deriveOrderStatus(createdAt, at(OFFSETS_MS.preparing - 1))).toBe("confirmed");
    expect(deriveOrderStatus(createdAt, at(OFFSETS_MS.driver_assigned - 1))).toBe(
      "preparing",
    );
    expect(deriveOrderStatus(createdAt, at(OFFSETS_MS.on_the_way - 1))).toBe(
      "driver_assigned",
    );
    expect(deriveOrderStatus(createdAt, at(OFFSETS_MS.delivered - 1))).toBe("on_the_way");
  });

  it("stays delivered after the final boundary", () => {
    expect(deriveOrderStatus(createdAt, at(OFFSETS_MS.delivered + 60_000))).toBe(
      "delivered",
    );
  });
});

describe("deriveDriverProgress", () => {
  it("is 0 before the order is on the way", () => {
    expect(deriveDriverProgress(createdAt, at(0))).toBe(0);
    expect(deriveDriverProgress(createdAt, at(OFFSETS_MS.preparing))).toBe(0);
    expect(deriveDriverProgress(createdAt, at(OFFSETS_MS.driver_assigned))).toBe(0);
    // At the instant it goes on_the_way, the driver has not departed yet.
    expect(deriveDriverProgress(createdAt, at(OFFSETS_MS.on_the_way))).toBe(0);
  });

  it("ramps from 0 to 1 across the delivery leg", () => {
    const start = OFFSETS_MS.on_the_way;
    const end = OFFSETS_MS.delivered;
    const mid = start + (end - start) / 2;
    const quarter = start + (end - start) / 4;

    expect(deriveDriverProgress(createdAt, at(quarter))).toBeCloseTo(0.25, 10);
    expect(deriveDriverProgress(createdAt, at(mid))).toBeCloseTo(0.5, 10);
  });

  it("increases monotonically during the delivery leg", () => {
    const start = OFFSETS_MS.on_the_way;
    const end = OFFSETS_MS.delivered;
    let prev = deriveDriverProgress(createdAt, at(start));
    for (let t = start + 1000; t <= end; t += 1000) {
      const next = deriveDriverProgress(createdAt, at(t));
      expect(next).toBeGreaterThanOrEqual(prev);
      prev = next;
    }
  });

  it("is 1 once delivered and stays there", () => {
    expect(deriveDriverProgress(createdAt, at(OFFSETS_MS.delivered))).toBe(1);
    expect(deriveDriverProgress(createdAt, at(OFFSETS_MS.delivered + 60_000))).toBe(1);
  });
});

describe("deriveEtaMinutes", () => {
  it("decreases over time", () => {
    const t0 = deriveEtaMinutes(createdAt, at(0));
    const t1 = deriveEtaMinutes(createdAt, at(OFFSETS_MS.preparing));
    const t2 = deriveEtaMinutes(createdAt, at(OFFSETS_MS.on_the_way));
    expect(t0).toBeGreaterThan(t1);
    expect(t1).toBeGreaterThan(t2);
  });

  it("never increases as elapsed time grows", () => {
    let prev = deriveEtaMinutes(createdAt, at(0));
    for (let t = 1000; t <= OFFSETS_MS.delivered; t += 1000) {
      const next = deriveEtaMinutes(createdAt, at(t));
      expect(next).toBeLessThanOrEqual(prev);
      prev = next;
    }
  });

  it("reaches 0 at delivery and stays at 0 after", () => {
    expect(deriveEtaMinutes(createdAt, at(OFFSETS_MS.delivered))).toBe(0);
    expect(deriveEtaMinutes(createdAt, at(OFFSETS_MS.delivered + 60_000))).toBe(0);
  });
});

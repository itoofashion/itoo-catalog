import { describe, expect, it } from "vitest";
import { isNewArrival, NEW_ARRIVAL_DAYS } from "./arrivals";

const now = new Date("2026-08-04T12:00:00Z");
const daysAgo = (n: number) =>
  new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("isNewArrival", () => {
  it("marks products added within the window", () => {
    expect(isNewArrival(daysAgo(0), now)).toBe(true);
    expect(isNewArrival(daysAgo(7), now)).toBe(true);
    expect(isNewArrival(daysAgo(NEW_ARRIVAL_DAYS - 1), now)).toBe(true);
  });

  it("stops marking products once the window passes", () => {
    expect(isNewArrival(daysAgo(NEW_ARRIVAL_DAYS + 1), now)).toBe(false);
    expect(isNewArrival(daysAgo(365), now)).toBe(false);
  });

  it("treats the boundary itself as still new", () => {
    expect(isNewArrival(daysAgo(NEW_ARRIVAL_DAYS), now)).toBe(true);
  });

  it("handles FashionGo timestamps that carry no timezone", () => {
    expect(isNewArrival("2026-07-28T15:02:43.153", now)).toBe(true);
    expect(isNewArrival("2025-01-28T15:02:43.153", now)).toBe(false);
  });

  it("does not crash on a malformed date", () => {
    expect(isNewArrival("not a date", now)).toBe(false);
  });
});

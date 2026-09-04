import { describe, expect, it } from "vitest";

import {
  addDays,
  daysInMonth,
  daysRemainingInMonth,
  dayOfMonth,
  startOfDay,
  startOfMonth,
  startOfPreviousMonth,
} from "./period";

describe("startOfDay", () => {
  it("returns local midnight for a UTC-ahead timezone (Moscow, UTC+3)", () => {
    // 2026-03-15 10:00 Moscow time = 2026-03-15 07:00 UTC
    const instant = new Date("2026-03-15T07:00:00Z");
    expect(startOfDay(instant, "Europe/Moscow").toISOString()).toBe("2026-03-14T21:00:00.000Z");
  });

  it("returns local midnight for a UTC-behind timezone (New York)", () => {
    // 2026-03-15 02:00 UTC is still 2026-03-14 evening in New York (UTC-4/-5)
    const instant = new Date("2026-03-15T02:00:00Z");
    const localMidnight = startOfDay(instant, "America/New_York");
    // Verify round-trip: formatting the result back in that zone gives 00:00:00 on the same local day.
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(localMidnight);
    expect(formatted).toMatch(/03\/14\/2026, 00:00/);
  });

  it("is correct across a DST spring-forward boundary (America/New_York, 2026-03-08)", () => {
    const beforeDst = new Date("2026-03-09T04:30:00Z"); // local time after the jump
    const start = startOfDay(beforeDst, "America/New_York");
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }).format(start);
    expect(formatted).toMatch(/00:00/);
  });
});

describe("startOfMonth / startOfPreviousMonth", () => {
  it("gives the 1st of the current and previous month in the user's timezone", () => {
    const instant = new Date("2026-03-15T07:00:00Z"); // 2026-03-15 10:00 Moscow
    expect(startOfMonth(instant, "Europe/Moscow").toISOString()).toBe("2026-02-28T21:00:00.000Z");
    expect(startOfPreviousMonth(instant, "Europe/Moscow").toISOString()).toBe(
      "2026-01-31T21:00:00.000Z",
    );
  });

  it("handles January correctly by rolling back to December of the previous year", () => {
    const instant = new Date("2026-01-10T07:00:00Z");
    const prev = startOfPreviousMonth(instant, "Europe/Moscow");
    // Local midnight of Dec 1 2025 in Moscow (UTC+3) is Nov 30 2025 21:00 UTC — the UTC
    // calendar date legitimately differs from the local one; that's the whole point of
    // returning an instant rather than a naive Y-M-D triple.
    expect(prev.toISOString()).toBe("2025-11-30T21:00:00.000Z");
  });
});

describe("daysInMonth / dayOfMonth / daysRemainingInMonth", () => {
  it("counts a partial (mid) month correctly", () => {
    const instant = new Date("2026-03-15T07:00:00Z"); // March has 31 days, local day 15
    expect(daysInMonth(instant, "Europe/Moscow")).toBe(31);
    expect(dayOfMonth(instant, "Europe/Moscow")).toBe(15);
    expect(daysRemainingInMonth(instant, "Europe/Moscow")).toBe(31 - 15 + 1);
  });

  it("handles February in a leap year", () => {
    const instant = new Date("2028-02-10T07:00:00Z");
    expect(daysInMonth(instant, "Europe/Moscow")).toBe(29);
  });

  it("treats the last day of the month as zero days remaining after today", () => {
    const instant = new Date("2026-03-31T07:00:00Z");
    expect(daysRemainingInMonth(instant, "Europe/Moscow")).toBe(1);
  });
});

describe("addDays", () => {
  it("adds whole days regardless of timezone (pure UTC instant arithmetic)", () => {
    const start = new Date("2026-03-15T00:00:00Z");
    expect(addDays(start, 3).toISOString()).toBe("2026-03-18T00:00:00.000Z");
    expect(addDays(start, 0).toISOString()).toBe(start.toISOString());
  });
});

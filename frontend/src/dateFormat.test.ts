import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { formatDate, formatRelative } from "./dateFormat";

describe("formatDate", () => {
  it("formats ISO date to US locale string", () => {
    // Note: exact output depends on locale, but should contain year/month/day parts
    const result = formatDate("2026-03-15T10:00:00Z");
    expect(result).toContain("2026");
    expect(result).toContain("15");
  });

  it("handles various ISO formats", () => {
    expect(formatDate("2024-06-15T12:00:00Z")).toContain("2024");
    expect(formatDate("2025-06-15")).toContain("2025");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-04-01T12:00:00Z");

  it("returns 'Never' for null", () => {
    expect(formatRelative(null, now)).toBe("Never");
  });

  it("returns 'Just now' for < 1 minute ago", () => {
    expect(formatRelative("2026-04-01T11:59:30Z", now)).toBe("Just now");
  });

  it("returns minutes for < 60 minutes ago", () => {
    expect(formatRelative("2026-04-01T11:30:00Z", now)).toBe("30m ago");
    expect(formatRelative("2026-04-01T11:55:00Z", now)).toBe("5m ago");
  });

  it("returns hours for < 24 hours ago", () => {
    expect(formatRelative("2026-04-01T06:00:00Z", now)).toBe("6h ago");
    expect(formatRelative("2026-04-01T00:00:00Z", now)).toBe("12h ago");
  });

  it("returns days for < 7 days ago", () => {
    expect(formatRelative("2026-03-30T12:00:00Z", now)).toBe("2d ago");
    expect(formatRelative("2026-03-26T12:00:00Z", now)).toBe("6d ago");
  });

  it("returns formatted date for >= 7 days ago", () => {
    const result = formatRelative("2026-03-01T12:00:00Z", now);
    expect(result).toContain("2026");
  });

  it("property: result is always a non-empty string", () => {
    const isoArb = fc.constantFrom(
      null, "2026-04-01T11:59:59Z", "2026-04-01T11:00:00Z",
      "2026-03-31T12:00:00Z", "2026-03-20T12:00:00Z", "2025-01-01T00:00:00Z",
    );
    fc.assert(fc.property(isoArb, (iso) => {
      const result = formatRelative(iso, now);
      expect(result.length).toBeGreaterThan(0);
    }), { numRuns: 20 });
  });

  it("property: more recent dates never produce 'older' labels", () => {
    // Verify monotonicity: if A is more recent than B, formatRelative(A) should not
    // show a larger time unit than formatRelative(B)
    const order = ["Just now", "m ago", "h ago", "d ago"];
    const rank = (s: string) => {
      for (let i = 0; i < order.length; i++) {
        if (s.includes(order[i]) || s === order[i]) return i;
      }
      return order.length; // formatted date = oldest
    };

    const pairs = fc.constantFrom(
      ["2026-04-01T11:59:59Z", "2026-04-01T11:30:00Z"],
      ["2026-04-01T11:30:00Z", "2026-04-01T06:00:00Z"],
      ["2026-04-01T06:00:00Z", "2026-03-30T12:00:00Z"],
      ["2026-03-30T12:00:00Z", "2026-03-01T12:00:00Z"],
    ) as fc.Arbitrary<[string, string]>;

    fc.assert(fc.property(pairs, ([recent, older]) => {
      expect(rank(formatRelative(recent, now))).toBeLessThanOrEqual(rank(formatRelative(older, now)));
    }), { numRuns: 20 });
  });
});

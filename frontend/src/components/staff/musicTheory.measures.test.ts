import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import {
  beatValue,
  computeMeasures,
  remainingInLastMeasure,
  fillWithRests,
  consolidateRests,
} from "./musicTheory";
import type { PlacedBeat, Duration } from "./types";

const NUM_RUNS = 20;
const durations: Duration[] = ["whole", "half", "quarter", "eighth", "sixteenth"];

function makeBeat(duration: Duration, dotted = false, isRest = false): PlacedBeat {
  return { notes: isRest ? [] : [{ dp: 30, staff: "treble" as const, accidental: "" as const }], duration, dotted, isRest };
}

const arbDuration: fc.Arbitrary<Duration> = fc.constantFrom(...durations);

// ── computeMeasures ─────────────────────────────────────────────────

describe("computeMeasures", () => {
  it("groups 4 quarter notes into 1 measure in 4/4", () => {
    const beats = [makeBeat("quarter"), makeBeat("quarter"), makeBeat("quarter"), makeBeat("quarter")];
    expect(computeMeasures(beats, 4, 4)).toEqual([{ startIdx: 0, count: 4 }]);
  });

  it("groups 8 quarter notes into 2 measures in 4/4", () => {
    const beats = Array.from({ length: 8 }, () => makeBeat("quarter"));
    const measures = computeMeasures(beats, 4, 4);
    expect(measures).toHaveLength(2);
    expect(measures[0]).toEqual({ startIdx: 0, count: 4 });
    expect(measures[1]).toEqual({ startIdx: 4, count: 4 });
  });

  it("handles 3/4 time", () => {
    const beats = Array.from({ length: 6 }, () => makeBeat("quarter"));
    const measures = computeMeasures(beats, 3, 4);
    expect(measures).toHaveLength(2);
    expect(measures[0].count).toBe(3);
    expect(measures[1].count).toBe(3);
  });

  it("handles mixed durations", () => {
    const beats = [makeBeat("half"), makeBeat("quarter"), makeBeat("quarter")];
    expect(computeMeasures(beats, 4, 4)).toEqual([{ startIdx: 0, count: 3 }]);
  });

  it("empty beats returns empty measures", () => {
    expect(computeMeasures([], 4, 4)).toEqual([]);
  });

  it("property: total beats equals input length", () => {
    fc.assert(fc.property(
      fc.array(arbDuration.map((d) => makeBeat(d)), { minLength: 1, maxLength: 20 }),
      (beats) => {
        expect(computeMeasures(beats, 4, 4).reduce((s, m) => s + m.count, 0)).toBe(beats.length);
      }
    ), { numRuns: NUM_RUNS });
  });

  it("property: measures are contiguous", () => {
    fc.assert(fc.property(
      fc.array(arbDuration.map((d) => makeBeat(d)), { minLength: 1, maxLength: 20 }),
      (beats) => {
        const measures = computeMeasures(beats, 4, 4);
        for (let i = 1; i < measures.length; i++) {
          expect(measures[i].startIdx).toBe(measures[i - 1].startIdx + measures[i - 1].count);
        }
      }
    ), { numRuns: NUM_RUNS });
  });

  it("property: no multi-beat measure exceeds capacity", () => {
    fc.assert(fc.property(
      fc.array(arbDuration.map((d) => makeBeat(d)), { minLength: 1, maxLength: 12 }),
      fc.constantFrom([4, 4] as const, [3, 4] as const, [6, 8] as const),
      (beats, [top, bottom]) => {
        const cap = top / bottom;
        for (const m of computeMeasures(beats, top, bottom)) {
          if (m.count <= 1) continue;
          let used = 0;
          for (let i = m.startIdx; i < m.startIdx + m.count; i++) used += beatValue(beats[i]);
          expect(used).toBeLessThanOrEqual(cap + 1e-9);
        }
      }
    ), { numRuns: NUM_RUNS });
  });
});

// ── remainingInLastMeasure ──────────────────────────────────────────

describe("remainingInLastMeasure", () => {
  it("returns full capacity for empty beats", () => {
    expect(remainingInLastMeasure([], 4, 4)).toBe(1);
  });

  it("returns remaining space after partial measure", () => {
    expect(remainingInLastMeasure([makeBeat("quarter"), makeBeat("quarter")], 4, 4)).toBeCloseTo(0.5);
  });

  it("returns full capacity when last measure is complete", () => {
    expect(remainingInLastMeasure(Array.from({ length: 4 }, () => makeBeat("quarter")), 4, 4)).toBe(1);
  });
});

// ── fillWithRests ───────────────────────────────────────────────────

describe("fillWithRests", () => {
  it("fills a quarter note space with a quarter rest", () => {
    const rests = fillWithRests(0.25);
    expect(rests).toHaveLength(1);
    expect(rests[0].duration).toBe("quarter");
    expect(rests[0].isRest).toBe(true);
  });

  it("fills a whole note space", () => {
    expect(fillWithRests(1)[0].duration).toBe("whole");
  });

  it("fills a half note space", () => {
    expect(fillWithRests(0.5)[0].duration).toBe("half");
  });

  it("all returned beats are rests", () => {
    for (const r of fillWithRests(0.75)) {
      expect(r.isRest).toBe(true);
      expect(r.notes).toEqual([]);
    }
  });

  it("property: total rest duration equals input", () => {
    fc.assert(fc.property(
      fc.constantFrom(0.25, 0.5, 0.75, 1, 0.125, 0.0625),
      (remaining) => {
        const total = fillWithRests(remaining).reduce((s, r) => s + beatValue(r), 0);
        expect(total).toBeCloseTo(remaining);
      }
    ), { numRuns: NUM_RUNS });
  });
});

// ── consolidateRests ────────────────────────────────────────────────

describe("consolidateRests", () => {
  it("merges consecutive rests", () => {
    const beats = [makeBeat("eighth", false, true), makeBeat("eighth", false, true), makeBeat("quarter"), makeBeat("quarter")];
    const result = consolidateRests(beats, 4, 4);
    expect(result.filter((b) => !b.isRest)).toHaveLength(2);
    expect(result.filter((b) => b.isRest).reduce((s, r) => s + beatValue(r), 0)).toBeCloseTo(0.25);
  });

  it("preserves non-rest beats", () => {
    const beats = [makeBeat("quarter"), makeBeat("quarter"), makeBeat("quarter"), makeBeat("quarter")];
    expect(consolidateRests(beats, 4, 4)).toEqual(beats);
  });

  it("property: total duration preserved", () => {
    fc.assert(fc.property(
      fc.array(fc.oneof(
        fc.constant(makeBeat("quarter")), fc.constant(makeBeat("quarter", false, true)),
        fc.constant(makeBeat("eighth")), fc.constant(makeBeat("eighth", false, true)),
      ), { minLength: 1, maxLength: 8 }),
      (beats) => {
        const original = beats.reduce((s, b) => s + beatValue(b), 0);
        expect(consolidateRests(beats, 4, 4).reduce((s, b) => s + beatValue(b), 0)).toBeCloseTo(original);
      }
    ), { numRuns: NUM_RUNS });
  });
});

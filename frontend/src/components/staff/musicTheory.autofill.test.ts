import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import {
  beatValue,
  computeMeasures,
  consolidateRests,
  autoFillBeats,
  rewriteBeatsForKeySig,
  getKeySig,
  effectiveAccidental,
} from "./musicTheory";
import type { PlacedBeat, Duration, Accidental } from "./types";

const NUM_RUNS = 20;

function makeBeat(duration: Duration, dotted = false, isRest = false): PlacedBeat {
  return { notes: isRest ? [] : [{ dp: 30, staff: "treble" as const, accidental: "" as const }], duration, dotted, isRest };
}

const arbAccidental: fc.Arbitrary<Accidental> = fc.constantFrom("", "n", "#", "b");

// ── consolidateRests (algebraic properties) ─────────────────────────

describe("consolidateRests", () => {
  it("property: idempotent", () => {
    fc.assert(fc.property(
      fc.array(fc.oneof(
        fc.constant(makeBeat("quarter")), fc.constant(makeBeat("quarter", false, true)),
        fc.constant(makeBeat("eighth")), fc.constant(makeBeat("eighth", false, true)),
        fc.constant(makeBeat("half")), fc.constant(makeBeat("half", false, true)),
        fc.constant(makeBeat("sixteenth", false, true)),
      ), { minLength: 1, maxLength: 8 }),
      fc.constantFrom([4, 4] as const, [3, 4] as const, [6, 8] as const),
      (beats, [top, bottom]) => {
        const once = consolidateRests(beats, top, bottom);
        expect(consolidateRests(once, top, bottom)).toEqual(once);
      }
    ), { numRuns: NUM_RUNS });
  });

  it("property: non-rest beats preserved in order", () => {
    fc.assert(fc.property(
      fc.array(fc.oneof(
        fc.constant(makeBeat("quarter")), fc.constant(makeBeat("quarter", false, true)),
        fc.constant(makeBeat("eighth")), fc.constant(makeBeat("eighth", false, true)),
      ), { minLength: 1, maxLength: 8 }),
      (beats) => {
        expect(consolidateRests(beats, 4, 4).filter((b) => !b.isRest)).toEqual(beats.filter((b) => !b.isRest));
      }
    ), { numRuns: NUM_RUNS });
  });
});

// ── autoFillBeats ───────────────────────────────────────────────────

describe("autoFillBeats", () => {
  it("fills empty beats with rests for one full measure", () => {
    const total = autoFillBeats([], 4, 4).reduce((s, b) => s + beatValue(b), 0);
    expect(total).toBeCloseTo(1);
  });

  it("completes a partial measure with rests", () => {
    const total = autoFillBeats([makeBeat("quarter"), makeBeat("quarter")], 4, 4).reduce((s, b) => s + beatValue(b), 0);
    expect(total).toBeCloseTo(1);
  });

  it("returns full measure unchanged", () => {
    const beats = Array.from({ length: 4 }, () => makeBeat("quarter"));
    expect(autoFillBeats(beats, 4, 4)).toEqual(beats);
  });

  it("property: idempotent", () => {
    fc.assert(fc.property(
      fc.array(fc.oneof(
        fc.constant(makeBeat("quarter")), fc.constant(makeBeat("eighth")),
        fc.constant(makeBeat("half")), fc.constant(makeBeat("quarter", false, true)),
      ), { minLength: 0, maxLength: 8 }),
      fc.constantFrom([4, 4] as const, [3, 4] as const, [6, 8] as const),
      (beats, [top, bottom]) => {
        const once = autoFillBeats(beats, top, bottom);
        expect(autoFillBeats(once, top, bottom)).toEqual(once);
      }
    ), { numRuns: NUM_RUNS });
  });

  it("property: completes the last measure", () => {
    fc.assert(fc.property(
      fc.array(fc.oneof(
        fc.constant(makeBeat("quarter")), fc.constant(makeBeat("eighth")),
        fc.constant(makeBeat("half")), fc.constant(makeBeat("sixteenth")),
      ), { minLength: 0, maxLength: 8 }),
      fc.constantFrom([4, 4] as const, [3, 4] as const, [6, 8] as const),
      (beats, [top, bottom]) => {
        const filled = autoFillBeats(beats, top, bottom);
        const measures = computeMeasures(filled, top, bottom);
        if (measures.length === 0) return;
        const last = measures[measures.length - 1];
        let used = 0;
        for (let i = last.startIdx; i < last.startIdx + last.count; i++) used += beatValue(filled[i]);
        expect(used).toBeCloseTo(top / bottom);
      }
    ), { numRuns: NUM_RUNS });
  });

  it("property: preserves non-rest beats", () => {
    fc.assert(fc.property(
      fc.array(fc.oneof(fc.constant(makeBeat("quarter")), fc.constant(makeBeat("eighth"))), { minLength: 1, maxLength: 6 }),
      (beats) => {
        const filled = autoFillBeats(beats, 4, 4);
        for (let i = 0; i < beats.length; i++) {
          if (!beats[i].isRest) expect(filled[i]).toEqual(beats[i]);
        }
      }
    ), { numRuns: NUM_RUNS });
  });
});

// ── rewriteBeatsForKeySig ───────────────────────────────────────────

describe("rewriteBeatsForKeySig", () => {
  it("preserves sounding pitch when changing key sig", () => {
    const cMajor = { count: 0, type: "none" as const };
    const gMajor = { count: 1, type: "sharp" as const };
    const beats: PlacedBeat[] = [{ notes: [{ dp: 31, staff: "treble", accidental: "#" }], duration: "quarter" }];
    const rewritten = rewriteBeatsForKeySig(beats, cMajor, gMajor);
    expect(rewritten[0].notes[0].accidental).toBe("");
    expect(effectiveAccidental(rewritten[0].notes[0].accidental, 31, gMajor)).toBe(effectiveAccidental("#", 31, cMajor));
  });

  it("property: preserves all sounding pitches", () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 13 }),
      fc.integer({ min: 0, max: 13 }),
      fc.array(fc.record({ dp: fc.integer({ min: 14, max: 42 }), acc: arbAccidental }), { minLength: 1, maxLength: 5 }),
      (oldIdx, newIdx, noteSpecs) => {
        const oldKs = getKeySig(oldIdx, "major");
        const newKs = getKeySig(newIdx, "major");
        const beats: PlacedBeat[] = [{ notes: noteSpecs.map((n) => ({ dp: n.dp, staff: "treble" as const, accidental: n.acc })), duration: "quarter" as const }];
        const rewritten = rewriteBeatsForKeySig(beats, oldKs, newKs);
        for (let i = 0; i < noteSpecs.length; i++) {
          expect(effectiveAccidental(rewritten[0].notes[i].accidental, noteSpecs[i].dp, newKs))
            .toBe(effectiveAccidental(noteSpecs[i].acc, noteSpecs[i].dp, oldKs));
        }
      }
    ), { numRuns: NUM_RUNS });
  });

  it("property: roundtrip A\u2192B\u2192A recovers sounding pitches", () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 13 }),
      fc.integer({ min: 0, max: 13 }),
      fc.array(fc.record({ dp: fc.integer({ min: 14, max: 42 }), acc: arbAccidental }), { minLength: 1, maxLength: 5 }),
      (tonicA, tonicB, noteSpecs) => {
        const ksA = getKeySig(tonicA, "major");
        const ksB = getKeySig(tonicB, "major");
        const beats: PlacedBeat[] = [{ notes: noteSpecs.map((n) => ({ dp: n.dp, staff: "treble" as const, accidental: n.acc })), duration: "quarter" as const }];
        const rt = rewriteBeatsForKeySig(rewriteBeatsForKeySig(beats, ksA, ksB), ksB, ksA);
        for (let i = 0; i < noteSpecs.length; i++) {
          expect(effectiveAccidental(rt[0].notes[i].accidental, noteSpecs[i].dp, ksA))
            .toBe(effectiveAccidental(noteSpecs[i].acc, noteSpecs[i].dp, ksA));
        }
      }
    ), { numRuns: NUM_RUNS });
  });
});

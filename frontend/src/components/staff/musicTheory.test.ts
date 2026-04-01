import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import {
  dpToY,
  accidentalSymbol,
  durationCategory,
  dpToMidi,
  dpToNoteName,
  LETTERS,
  DURATION_VALUE,
  beatValue,
  durationFits,
  timeKey,
  beatTimeOffsets,
  getKeySig,
  keySignatureAccidental,
  effectiveAccidental,
  displayAccidental,
  storedForSounding,
  SCALE_OPTIONS,
} from "./musicTheory";
import { STEP } from "./constants";
import type { PlacedBeat, Duration, Accidental } from "./types";

// ── Helpers for test data ───────────────────────────────────────────

const durations: Duration[] = ["whole", "half", "quarter", "eighth", "sixteenth"];

function makeBeat(duration: Duration, dotted = false, isRest = false): PlacedBeat {
  return { notes: isRest ? [] : [{ dp: 30, staff: "treble" as const, accidental: "" as const }], duration, dotted, isRest };
}

const arbDuration: fc.Arbitrary<Duration> = fc.constantFrom(...durations);

// ── dpToY ───────────────────────────────────────────────────────────

describe("dpToY", () => {
  it("returns yOffset when dp equals staffTopDp", () => {
    expect(dpToY(38, 38, 100)).toBe(100);
  });

  it("increases y when dp is below staffTopDp", () => {
    expect(dpToY(36, 38, 100)).toBe(100 + 2 * STEP);
  });

  it("decreases y when dp is above staffTopDp", () => {
    expect(dpToY(40, 38, 100)).toBe(100 - 2 * STEP);
  });

  it("property: dpToY is linear in dp", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), fc.integer(), (dp, staffTop, yOff) => {
        const y1 = dpToY(dp, staffTop, yOff);
        const y2 = dpToY(dp + 1, staffTop, yOff);
        expect(y1 - y2).toBe(STEP);
      })
    );
  });
});

// ── accidentalSymbol ────────────────────────────────────────────────

describe("accidentalSymbol", () => {
  it("maps sharp to unicode sharp", () => {
    expect(accidentalSymbol("#")).toBe("\u266F");
  });

  it("maps flat to unicode flat", () => {
    expect(accidentalSymbol("b")).toBe("\u266D");
  });

  it("maps double-sharp", () => {
    expect(accidentalSymbol("##")).toBe("\uD834\uDD2A");
  });

  it("maps double-flat", () => {
    expect(accidentalSymbol("bb")).toBe("\uD834\uDD2B");
  });

  it("returns empty for unknown input", () => {
    expect(accidentalSymbol("")).toBe("");
    expect(accidentalSymbol("x")).toBe("");
  });
});

// ── durationCategory ────────────────────────────────────────────────

describe("durationCategory", () => {
  it("classifies standard fractions", () => {
    expect(durationCategory(1)).toBe("whole");
    expect(durationCategory(0.5)).toBe("half");
    expect(durationCategory(0.25)).toBe("quarter");
    expect(durationCategory(0.125)).toBe("eighth");
    expect(durationCategory(0.0625)).toBe("sixteenth");
  });

  it("classifies values above thresholds", () => {
    expect(durationCategory(2)).toBe("whole");
    expect(durationCategory(0.75)).toBe("half");
    expect(durationCategory(0.3)).toBe("quarter");
  });
});

// ── dpToMidi ────────────────────────────────────────────────────────

describe("dpToMidi", () => {
  it("C4 (dp=28) with no accidental is MIDI 60", () => {
    expect(dpToMidi(28, "")).toBe(60);
  });

  it("C#4 is MIDI 61", () => {
    expect(dpToMidi(28, "#")).toBe(61);
  });

  it("Cb4 is MIDI 59", () => {
    expect(dpToMidi(28, "b")).toBe(59);
  });

  it("A4 (dp=33) is MIDI 69", () => {
    expect(dpToMidi(33, "")).toBe(69);
  });

  it("property: sharping a note raises MIDI by 1", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 70 }), (dp) => {
        expect(dpToMidi(dp, "#") - dpToMidi(dp, "")).toBe(1);
      })
    );
  });

  it("property: flatting a note lowers MIDI by 1", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 70 }), (dp) => {
        expect(dpToMidi(dp, "b") - dpToMidi(dp, "")).toBe(-1);
      })
    );
  });

  it("property: going up one octave (7 dps) raises MIDI by 12", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 63 }), (dp) => {
        expect(dpToMidi(dp + 7, "") - dpToMidi(dp, "")).toBe(12);
      })
    );
  });
});

// ── dpToNoteName ────────────────────────────────────────────────────

describe("dpToNoteName", () => {
  it("dp=28 is C4", () => {
    expect(dpToNoteName(28)).toBe("C4");
  });

  it("dp=33 is A4", () => {
    expect(dpToNoteName(33)).toBe("A4");
  });

  it("property: note names cycle through CDEFGAB", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 70 }), (dp) => {
        const name = dpToNoteName(dp);
        const letter = name[0];
        expect(LETTERS).toContain(letter);
      })
    );
  });

  it("property: same letter repeats every 7 dps", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 63 }), (dp) => {
        expect(dpToNoteName(dp)[0]).toBe(dpToNoteName(dp + 7)[0]);
      })
    );
  });
});

// ── beatValue ───────────────────────────────────────────────────────

describe("beatValue", () => {
  it("quarter note = 0.25", () => {
    expect(beatValue(makeBeat("quarter"))).toBe(0.25);
  });

  it("dotted quarter = 0.375", () => {
    expect(beatValue(makeBeat("quarter", true))).toBeCloseTo(0.375);
  });

  it("whole note = 1", () => {
    expect(beatValue(makeBeat("whole"))).toBe(1);
  });

  it("property: dotted duration is 1.5x undotted", () => {
    fc.assert(
      fc.property(arbDuration, (dur) => {
        const plain = beatValue(makeBeat(dur, false));
        const dotted = beatValue(makeBeat(dur, true));
        expect(dotted).toBeCloseTo(plain * 1.5);
      })
    );
  });
});

// ── durationFits ────────────────────────────────────────────────────

describe("durationFits", () => {
  it("quarter fits in 0.25 remaining", () => {
    expect(durationFits("quarter", 0.25)).toBe(true);
  });

  it("half does not fit in 0.25 remaining", () => {
    expect(durationFits("half", 0.25)).toBe(false);
  });

  it("dotted quarter fits in 0.375", () => {
    expect(durationFits("quarter", 0.375, true)).toBe(true);
  });

  it("dotted quarter does not fit in 0.25", () => {
    expect(durationFits("quarter", 0.25, true)).toBe(false);
  });

  it("property: a duration always fits in a space >= its value", () => {
    fc.assert(
      fc.property(arbDuration, fc.boolean(), (dur, dotted) => {
        const val = DURATION_VALUE[dur] * (dotted ? 1.5 : 1);
        expect(durationFits(dur, val, dotted)).toBe(true);
        expect(durationFits(dur, val + 0.001, dotted)).toBe(true);
      })
    );
  });
});

// ── timeKey ─────────────────────────────────────────────────────────

describe("timeKey", () => {
  it("rounds to 4 decimal places", () => {
    expect(timeKey(0.33333333)).toBe(0.3333);
  });

  it("preserves exact values", () => {
    expect(timeKey(0.25)).toBe(0.25);
    expect(timeKey(0.5)).toBe(0.5);
    expect(timeKey(1)).toBe(1);
  });

  it("property: timeKey is idempotent", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), (t) => {
        expect(timeKey(timeKey(t))).toBe(timeKey(t));
      })
    );
  });
});

// ── beatTimeOffsets ─────────────────────────────────────────────────

describe("beatTimeOffsets", () => {
  it("starts at 0", () => {
    const beats = [makeBeat("quarter")];
    expect(beatTimeOffsets(beats)[0]).toBe(0);
  });

  it("accumulates correctly for uniform beats", () => {
    const beats = Array.from({ length: 4 }, () => makeBeat("quarter"));
    const offsets = beatTimeOffsets(beats);
    expect(offsets).toEqual([0, 0.25, 0.5, 0.75]);
  });

  it("property: offsets are non-decreasing", () => {
    fc.assert(
      fc.property(
        fc.array(arbDuration.map((d) => makeBeat(d)), { minLength: 1, maxLength: 20 }),
        (beats) => {
          const offsets = beatTimeOffsets(beats);
          for (let i = 1; i < offsets.length; i++) {
            expect(offsets[i]).toBeGreaterThanOrEqual(offsets[i - 1]);
          }
        }
      )
    );
  });

  it("property: length equals input length", () => {
    fc.assert(
      fc.property(
        fc.array(arbDuration.map((d) => makeBeat(d)), { minLength: 0, maxLength: 20 }),
        (beats) => {
          expect(beatTimeOffsets(beats)).toHaveLength(beats.length);
        }
      )
    );
  });
});

// ── getKeySig ───────────────────────────────────────────────────────

describe("getKeySig", () => {
  it("C major has no accidentals", () => {
    expect(getKeySig(0, "major")).toEqual({ count: 0, type: "none" });
  });

  it("G major has 1 sharp", () => {
    expect(getKeySig(9, "major")).toEqual({ count: 1, type: "sharp" });
  });

  it("F major has 1 flat", () => {
    expect(getKeySig(6, "major")).toEqual({ count: 1, type: "flat" });
  });

  it("A minor has no accidentals", () => {
    expect(getKeySig(11, "minor")).toEqual({ count: 0, type: "none" });
  });

  it("D dorian has no accidentals (same as C major)", () => {
    expect(getKeySig(3, "dorian")).toEqual({ count: 0, type: "none" });
  });

  it("property: count is always non-negative", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 13 }),
        fc.constantFrom(...SCALE_OPTIONS.map((s) => s.value)),
        (tonicIdx, scale) => {
          const ks = getKeySig(tonicIdx, scale);
          expect(ks.count).toBeGreaterThanOrEqual(0);
        }
      )
    );
  });

  it("property: count <= 7", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 13 }),
        fc.constantFrom(...SCALE_OPTIONS.map((s) => s.value)),
        (tonicIdx, scale) => {
          const ks = getKeySig(tonicIdx, scale);
          expect(ks.count).toBeLessThanOrEqual(7);
        }
      )
    );
  });

  it("property: type is none iff count is 0", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 13 }),
        fc.constantFrom(...SCALE_OPTIONS.map((s) => s.value)),
        (tonicIdx, scale) => {
          const ks = getKeySig(tonicIdx, scale);
          if (ks.count === 0) expect(ks.type).toBe("none");
          else expect(ks.type).not.toBe("none");
        }
      )
    );
  });
});

// ── keySignatureAccidental ──────────────────────────────────────────

describe("keySignatureAccidental", () => {
  it("returns empty for C major (no accidentals)", () => {
    expect(keySignatureAccidental(28, { count: 0, type: "none" })).toBe("");
  });

  it("F is sharp in G major (1 sharp)", () => {
    expect(keySignatureAccidental(31, { count: 1, type: "sharp" })).toBe("#");
  });

  it("B is flat in F major (1 flat)", () => {
    expect(keySignatureAccidental(34, { count: 1, type: "flat" })).toBe("b");
  });

  it("C is not affected by 1 sharp", () => {
    expect(keySignatureAccidental(28, { count: 1, type: "sharp" })).toBe("");
  });

  it("property: returns only valid accidentals", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 70 }),
        fc.integer({ min: 0, max: 7 }),
        fc.constantFrom("sharp" as const, "flat" as const, "none" as const),
        (dp, count, type) => {
          const acc = keySignatureAccidental(dp, { count, type });
          expect(["", "#", "b"]).toContain(acc);
        }
      )
    );
  });
});

// ── effectiveAccidental ─────────────────────────────────────────────

describe("effectiveAccidental", () => {
  const noKeySig = { count: 0, type: "none" as const };
  const gMajor = { count: 1, type: "sharp" as const };

  it("empty stored follows key sig", () => {
    expect(effectiveAccidental("", 31, gMajor)).toBe("#");
  });

  it("natural overrides key sig to natural", () => {
    expect(effectiveAccidental("n", 31, gMajor)).toBe("");
  });

  it("explicit sharp returns sharp", () => {
    expect(effectiveAccidental("#", 28, noKeySig)).toBe("#");
  });

  it("explicit flat returns flat", () => {
    expect(effectiveAccidental("b", 28, noKeySig)).toBe("b");
  });
});

// ── displayAccidental ───────────────────────────────────────────────

describe("displayAccidental", () => {
  const gMajor = { count: 1, type: "sharp" as const };
  const noKeySig = { count: 0, type: "none" as const };

  it("shows nothing when note matches key sig", () => {
    expect(displayAccidental("", 31, gMajor)).toBe("");
  });

  it("shows natural sign when overriding key sig sharp", () => {
    expect(displayAccidental("n", 31, gMajor)).toBe("\u266E");
  });

  it("shows sharp sign for explicit sharp in no-accidental key", () => {
    expect(displayAccidental("#", 28, noKeySig)).toBe("\u266F");
  });

  it("shows nothing for natural in a key with no accidentals", () => {
    expect(displayAccidental("", 28, noKeySig)).toBe("");
  });
});

// ── storedForSounding ───────────────────────────────────────────────

describe("storedForSounding", () => {
  it("returns empty when sounding matches new key sig", () => {
    const gMajor = { count: 1, type: "sharp" as const };
    expect(storedForSounding("#", 31, gMajor)).toBe("");
  });

  it("returns 'n' when sounding is natural but key sig has accidental", () => {
    const gMajor = { count: 1, type: "sharp" as const };
    expect(storedForSounding("", 31, gMajor)).toBe("n");
  });

  it("returns explicit accidental otherwise", () => {
    const noKeySig = { count: 0, type: "none" as const };
    expect(storedForSounding("#", 28, noKeySig)).toBe("#");
  });
});

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { lastMeasureHasNote, padToMeasures, soundingNotes } from "./noteEditorHelpers";
import type { PlacedBeat, PlacedNote } from "./types";

const rest = (dur: "whole" | "half" | "quarter" = "quarter"): PlacedBeat => ({
  notes: [], duration: dur, isRest: true,
});

const note = (dp: number, dur: "whole" | "half" | "quarter" | "eighth" = "quarter"): PlacedBeat => ({
  notes: [{ dp, staff: "treble" as const, accidental: "" as const }],
  duration: dur,
  isRest: false,
});

describe("lastMeasureHasNote", () => {
  it("returns false for empty measures", () => {
    expect(lastMeasureHasNote([], [])).toBe(false);
  });

  it("returns false when last measure is all rests", () => {
    const beats = [rest(), rest(), rest(), rest()];
    const measures = [{ startIdx: 0, count: 2 }, { startIdx: 2, count: 2 }];
    expect(lastMeasureHasNote(beats, measures)).toBe(false);
  });

  it("returns true when last measure has a note", () => {
    const beats = [rest(), rest(), rest(), note(0)];
    const measures = [{ startIdx: 0, count: 2 }, { startIdx: 2, count: 2 }];
    expect(lastMeasureHasNote(beats, measures)).toBe(true);
  });

  it("only checks the last measure", () => {
    const beats = [note(0), note(1), rest(), rest()];
    const measures = [{ startIdx: 0, count: 2 }, { startIdx: 2, count: 2 }];
    expect(lastMeasureHasNote(beats, measures)).toBe(false);
  });
});

describe("padToMeasures", () => {
  const fillWithRests = (cap: number): PlacedBeat[] => {
    // Simplified: fill with quarter rests
    const rests: PlacedBeat[] = [];
    for (let i = 0; i < cap * 4; i++) rests.push(rest());
    return rests;
  };

  it("returns beats unchanged when mCount >= maxM", () => {
    const beats = [note(0), note(1)];
    expect(padToMeasures(beats, 4, 4, fillWithRests, 1)).toBe(beats);
    expect(padToMeasures(beats, 5, 4, fillWithRests, 1)).toBe(beats);
  });

  it("adds padding measures when mCount < maxM", () => {
    const beats = [note(0)];
    const result = padToMeasures(beats, 1, 3, fillWithRests, 1);
    expect(result.length).toBeGreaterThan(beats.length);
    // First beat should be the original note
    expect(result[0]).toEqual(note(0));
    // Remaining should be rests
    for (let i = 1; i < result.length; i++) {
      expect(result[i].isRest).toBe(true);
    }
  });

  it("property: result length >= input length", () => {
    const arb = fc.tuple(
      fc.integer({ min: 0, max: 5 }),
      fc.integer({ min: 0, max: 10 }),
    );
    fc.assert(fc.property(arb, ([mCount, maxM]) => {
      const beats = [note(0)];
      const result = padToMeasures(beats, mCount, maxM, fillWithRests, 1);
      expect(result.length).toBeGreaterThanOrEqual(beats.length);
    }), { numRuns: 20 });
  });
});

describe("soundingNotes", () => {
  it("returns empty for no beats", () => {
    expect(soundingNotes([], [], 0)).toEqual([]);
  });

  it("returns notes for beat at exact time", () => {
    const beats = [note(5)];
    const times = [0];
    const result = soundingNotes(beats, times, 0);
    expect(result).toHaveLength(1);
    expect(result[0].dp).toBe(5);
  });

  it("returns notes within beat duration", () => {
    // A quarter note at time 0 has duration 0.25 (beatValue)
    const beats = [note(5, "quarter")];
    const times = [0];
    // t=0.1 is within the quarter note's duration
    const result = soundingNotes(beats, times, 0.1);
    expect(result).toHaveLength(1);
  });

  it("returns empty for rest beats", () => {
    const beats = [rest()];
    const times = [0];
    expect(soundingNotes(beats, times, 0)).toEqual([]);
  });

  it("returns empty when time is before any beat", () => {
    const beats = [note(5)];
    const times = [1.0];
    expect(soundingNotes(beats, times, 0)).toEqual([]);
  });

  it("finds the correct beat for a given time", () => {
    const beats = [note(0), note(7)];
    const times = [0, 0.25];
    // At time 0.25, the second beat should be sounding
    const result = soundingNotes(beats, times, 0.25);
    expect(result).toHaveLength(1);
    expect(result[0].dp).toBe(7);
  });

  it("returns empty when beat has ended", () => {
    // Quarter note at time 0, duration 0.25; at t=0.5 it's over
    const beats = [note(5, "quarter")];
    const times = [0];
    expect(soundingNotes(beats, times, 0.5)).toEqual([]);
  });
});

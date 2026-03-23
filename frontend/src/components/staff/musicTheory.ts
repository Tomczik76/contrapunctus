import { STEP, CLEF_WIDTH, TS_WIDTH } from "./constants";
import type { Duration, Accidental, PlacedBeat } from "./types";
import type { Staff as StaffDef } from "../../contrapunctus";

// ── Basic helpers ───────────────────────────────────────────────────

/** Y position for a diatonic position relative to a staff's top line. */
export function dpToY(dp: number, staffTopDp: number, yOffset: number): number {
  return yOffset + (staffTopDp - dp) * STEP;
}

export function accidentalSymbol(acc: string): string {
  switch (acc) {
    case "#": return "\u266F";
    case "b": return "\u266D";
    case "##": return "\uD834\uDD2A";
    case "bb": return "\uD834\uDD2B";
    default: return "";
  }
}

/** Middle line of a 5-line staff (index 2). */
export function middleLine(staff: StaffDef): number {
  return staff.lines[2];
}

/** Determine note duration category from fraction of whole note. */
export function durationCategory(fraction: number): "whole" | "half" | "quarter" | "eighth" | "sixteenth" {
  if (fraction >= 1) return "whole";
  if (fraction >= 0.5) return "half";
  if (fraction >= 0.25) return "quarter";
  if (fraction >= 0.125) return "eighth";
  return "sixteenth";
}

// ── Note naming ─────────────────────────────────────────────────────

export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
// Semitone offset from C for each letter: C=0, D=2, E=4, F=5, G=7, A=9, B=11
export const LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

export function dpToMidi(dp: number, acc: Accidental): number {
  const letterIdx = ((dp % 7) + 7) % 7;
  const octave = Math.floor(dp / 7);
  const accOffset = acc === "#" ? 1 : acc === "b" ? -1 : 0;
  return (octave + 1) * 12 + LETTER_SEMITONES[letterIdx] + accOffset;
}

export function dpToNoteName(dp: number): string {
  const letterIdx = ((dp % 7) + 7) % 7;
  const octave = Math.floor(dp / 7);
  return `${LETTERS[letterIdx]}${octave}`;
}

// ── Editor staff constants ──────────────────────────────────────────

// Grand staff constants
export const ED_TREBLE_LINES = [30, 32, 34, 36, 38];
export const ED_BASS_LINES = [18, 20, 22, 24, 26];
export const ED_TREBLE_TOP = 38;
export const ED_TREBLE_MID = 34;
export const ED_BASS_TOP = 26;
export const ED_BASS_MID = 22;
export const ED_BASS_BOT = 18;
export const ED_GRAND_THRESHOLD = 28; // C4 — notes >= 28 go to treble
export const ED_CLEF_X = 12;
export const ED_TS_X = CLEF_WIDTH + 12;
export const ED_LEFT = CLEF_WIDTH + TS_WIDTH + 10;
export const ED_NOTE_SPACING = 55;
export const ED_BARLINE_GAP = 12;

// ── Duration / measure logic ────────────────────────────────────────

export const DURATION_VALUE: Record<Duration, number> = {
  whole: 1,
  half: 1 / 2,
  quarter: 1 / 4,
  eighth: 1 / 8,
  sixteenth: 1 / 16,
};

/** Get the time value of a beat, accounting for dotted durations. */
export function beatValue(beat: PlacedBeat): number {
  const base = DURATION_VALUE[beat.duration];
  return beat.dotted ? base * 1.5 : base;
}

/** Which durations fit in a given remaining measure space. */
export function durationFits(dur: Duration, remaining: number, dotted = false): boolean {
  const val = DURATION_VALUE[dur] * (dotted ? 1.5 : 1);
  return val <= remaining + 1e-9;
}

/** Compute measure groupings: array of { startIdx, count } into the flat beats array. */
export function computeMeasures(beats: PlacedBeat[], tsTop: number, tsBottom: number): { startIdx: number; count: number }[] {
  const measureCapacity = tsTop / tsBottom; // fraction of a whole note
  const measures: { startIdx: number; count: number }[] = [];
  let i = 0;
  while (i < beats.length) {
    let used = 0;
    const start = i;
    while (i < beats.length) {
      const val = beatValue(beats[i]);
      if (used + val > measureCapacity + 1e-9) break;
      used += val;
      i++;
    }
    measures.push({ startIdx: start, count: i - start });
  }
  return measures;
}

/** How much space remains in the last measure (or full capacity if all measures are complete). */
export function remainingInLastMeasure(beats: PlacedBeat[], tsTop: number, tsBottom: number): number {
  const measureCapacity = tsTop / tsBottom;
  const measures = computeMeasures(beats, tsTop, tsBottom);
  if (measures.length === 0) return measureCapacity;
  const last = measures[measures.length - 1];
  let used = 0;
  for (let i = last.startIdx; i < last.startIdx + last.count; i++) {
    used += beatValue(beats[i]);
  }
  const rem = measureCapacity - used;
  return rem < 1e-9 ? measureCapacity : rem; // if full, next beat starts a new measure
}

/** Fill remaining space in a measure with the largest rests that fit. */
/** Fill space with rests, respecting beat alignment.
 *  posInMeasure: how far into the measure the rest starts (fraction of whole note).
 *  beatUnit: the beat value (e.g. 1/4 for quarter-note beats). */
export function fillWithRests(remaining: number, posInMeasure = 0, beatUnit = 1 / 4): PlacedBeat[] {
  const rests: PlacedBeat[] = [];
  const durs: Duration[] = ["whole", "half", "quarter", "eighth", "sixteenth"];
  let left = remaining;
  let pos = posInMeasure;

  while (left > 1e-9) {
    // How much space to the next beat boundary?
    const inBeat = pos % beatUnit;
    const toNextBeat = inBeat < 1e-9 ? 0 : beatUnit - inBeat;

    if (toNextBeat > 1e-9 && toNextBeat <= left + 1e-9) {
      // Fill to the next beat boundary with small rests
      let sub = toNextBeat;
      while (sub > 1e-9) {
        const dur = durs.find((d) => DURATION_VALUE[d] <= sub + 1e-9);
        if (!dur) break;
        rests.push({ notes: [], duration: dur, isRest: true });
        sub -= DURATION_VALUE[dur];
        left -= DURATION_VALUE[dur];
        pos += DURATION_VALUE[dur];
      }
    } else {
      // On a beat boundary (or toNextBeat > left): use largest rest that fits
      const dur = durs.find((d) => DURATION_VALUE[d] <= left + 1e-9);
      if (!dur) break;
      rests.push({ notes: [], duration: dur, isRest: true });
      left -= DURATION_VALUE[dur];
      pos += DURATION_VALUE[dur];
    }
  }
  return rests;
}

/** Auto-fill the last measure of a beats array with rests. */
export function autoFillBeats(beats: PlacedBeat[], tsTop: number, tsBottom: number): PlacedBeat[] {
  const measureCap = tsTop / tsBottom;
  const measures = computeMeasures(beats, tsTop, tsBottom);
  if (measures.length === 0) return fillWithRests(measureCap);
  const last = measures[measures.length - 1];
  let used = 0;
  for (let i = last.startIdx; i < last.startIdx + last.count; i++) {
    used += beatValue(beats[i]);
  }
  const remaining = measureCap - used;
  if (remaining > 1e-9) {
    let trimEnd = beats.length;
    while (trimEnd > last.startIdx && beats[trimEnd - 1].isRest) trimEnd--;
    if (trimEnd <= last.startIdx) {
      return [...beats.slice(0, last.startIdx), ...fillWithRests(measureCap)];
    }
    const trimmed = beats.slice(0, trimEnd);
    let usedAfterTrim = 0;
    for (let i = last.startIdx; i < trimmed.length; i++) {
      usedAfterTrim += beatValue(trimmed[i]);
    }
    const remAfterTrim = measureCap - usedAfterTrim;
    if (remAfterTrim > 1e-9) {
      const bUnit = tsBottom > 0 ? 1 / tsBottom : 1 / 4;
      return [...trimmed, ...fillWithRests(remAfterTrim, usedAfterTrim, bUnit)];
    }
    return trimmed;
  }
  return beats;
}

/** Round to avoid floating point issues with music durations. */
export function timeKey(t: number): number {
  return Math.round(t * 10000) / 10000;
}

/** Compute cumulative time offsets for each beat. */
export function beatTimeOffsets(beats: PlacedBeat[]): number[] {
  const times: number[] = [];
  let t = 0;
  for (const b of beats) {
    times.push(timeKey(t));
    t += beatValue(b);
  }
  return times;
}

// ── Key Signature Data ──────────────────────────────────────────────

/** Diatonic positions for sharps in treble clef (F C G D A E B). */
export const TREBLE_SHARP_DPS = [38, 35, 32, 36, 33, 37, 34];
/** Diatonic positions for sharps in bass clef. */
export const BASS_SHARP_DPS = [24, 21, 18, 22, 19, 23, 20];
/** Diatonic positions for flats in treble clef (B E A D G C F). */
export const TREBLE_FLAT_DPS = [34, 37, 33, 36, 32, 35, 31];
/** Diatonic positions for flats in bass clef. */
export const BASS_FLAT_DPS = [20, 23, 19, 22, 18, 21, 24];

/** Circle-of-fifths position for each tonic index (positive = sharps, negative = flats). */
export const MAJOR_KEY_SIGS: Record<number, number> = {
  0: 0, 1: 7, 2: -5, 3: 2, 4: -3, 5: 4, 6: -1, 7: 6, 8: -6, 9: 1, 10: -4, 11: 3, 12: -2, 13: 5,
};
export const MINOR_KEY_SIGS: Record<number, number> = {
  0: -3, 1: 4, 2: 4, 3: -1, 4: -6, 5: 1, 6: -4, 7: 3, 8: 3, 9: -2, 10: -7, 11: 0, 12: -5, 13: 2,
};

/** Width per accidental glyph in the key signature. */
export const KS_ACCIDENTAL_W = 10;

// Semitone value for each tonicIdx: C=0, C#=1, Db=1, D=2, Eb=3, E=4, F=5, F#=6, Gb=6, G=7, Ab=8, A=9, Bb=10, B=11
export const TONIC_SEMITONES = [0, 1, 1, 2, 3, 4, 5, 6, 6, 7, 8, 9, 10, 11];

// All tonicIdx values for each semitone (enharmonic equivalents)
export const SEMITONE_TO_TONICS: Record<number, number[]> = {
  0: [0], 1: [1, 2], 2: [3], 3: [4], 4: [5], 5: [6], 6: [7, 8], 7: [9], 8: [10], 9: [11], 10: [12], 11: [13],
};

// Semitone offset from mode tonic to its relative major tonic
export const MODE_MAJOR_OFFSET: Record<string, number> = {
  dorian: 10,     // down whole step = +10
  phrygian: 8,    // down major 3rd = +8
  lydian: 7,      // down perfect 4th = +7
  mixolydian: 5,  // down perfect 5th = +5
  locrian: 1,     // down major 7th = +1
};

export function getKeySig(tonicIdx: number, scaleName: string): { count: number; type: "sharp" | "flat" | "none" } {
  const modeOffset = MODE_MAJOR_OFFSET[scaleName];
  if (modeOffset !== undefined) {
    // Find the relative major tonic and pick the enharmonic with fewest accidentals
    const semitone = TONIC_SEMITONES[tonicIdx];
    const majorSemitone = (semitone + modeOffset) % 12;
    const candidates = SEMITONE_TO_TONICS[majorSemitone] ?? [];
    let bestVal = 99;
    for (const idx of candidates) {
      const v = MAJOR_KEY_SIGS[idx] ?? 0;
      if (Math.abs(v) < Math.abs(bestVal)) bestVal = v;
    }
    if (bestVal === 99) bestVal = 0;
    if (bestVal > 0) return { count: bestVal, type: "sharp" };
    if (bestVal < 0) return { count: -bestVal, type: "flat" };
    return { count: 0, type: "none" };
  }
  const sigs = scaleName === "major" || scaleName === "ionian" ? MAJOR_KEY_SIGS : MINOR_KEY_SIGS;
  const val = sigs[tonicIdx] ?? 0;
  if (val > 0) return { count: val, type: "sharp" };
  if (val < 0) return { count: -val, type: "flat" };
  return { count: 0, type: "none" };
}

/** Order of note letters affected by sharps/flats in key signatures. */
export const SHARP_LETTER_INDICES = [3, 0, 4, 1, 5, 2, 6]; // F, C, G, D, A, E, B
export const FLAT_LETTER_INDICES = [6, 2, 5, 1, 4, 0, 3];   // B, E, A, D, G, C, F

/** Returns the accidental that the key signature applies to a given diatonic position. */
export function keySignatureAccidental(dp: number, keySig: { count: number; type: "sharp" | "flat" | "none" }): Accidental {
  if (keySig.count === 0 || keySig.type === "none") return "";
  const letterIdx = ((dp % 7) + 7) % 7;
  const order = keySig.type === "sharp" ? SHARP_LETTER_INDICES : FLAT_LETTER_INDICES;
  const affected = order.slice(0, keySig.count);
  if (affected.includes(letterIdx)) return keySig.type === "sharp" ? "#" : "b";
  return "";
}

/** Resolves a stored accidental to the effective (sounding) accidental.
 *  "" means "follow the key signature", "n" means "explicitly natural". */
export function effectiveAccidental(stored: Accidental, dp: number, keySig: { count: number; type: "sharp" | "flat" | "none" }): Accidental {
  if (stored === "") return keySignatureAccidental(dp, keySig);
  if (stored === "n") return "";
  return stored;
}

/** Returns the accidental symbol to display on a note (empty if implied by key signature). */
export function displayAccidental(stored: Accidental, dp: number, keySig: { count: number; type: "sharp" | "flat" | "none" }): string {
  const ksAcc = keySignatureAccidental(dp, keySig);
  const eff = effectiveAccidental(stored, dp, keySig);
  if (eff === ksAcc) return "";
  // Show natural sign when overriding a key signature accidental
  if (eff === "" && ksAcc !== "") return "\u266E";
  return accidentalSymbol(eff);
}

/** Given a note's sounding accidental under the old key sig, compute what
 *  stored accidental preserves that pitch under a new key sig. */
export function storedForSounding(
  sounding: Accidental,
  dp: number,
  newKeySig: { count: number; type: "sharp" | "flat" | "none" }
): Accidental {
  const ksAcc = keySignatureAccidental(dp, newKeySig);
  // If the key sig already gives us the right accidental, store "" (follow key sig)
  if (sounding === ksAcc) return "";
  // If sounding is natural but key sig applies something, store "n"
  if (sounding === "" && ksAcc !== "") return "n";
  // Otherwise store the explicit accidental
  return sounding;
}

export function rewriteBeatsForKeySig(
  beats: PlacedBeat[],
  oldKeySig: { count: number; type: "sharp" | "flat" | "none" },
  newKeySig: { count: number; type: "sharp" | "flat" | "none" }
): PlacedBeat[] {
  return beats.map((beat) => ({
    ...beat,
    notes: beat.notes.map((n) => {
      const sounding = effectiveAccidental(n.accidental, n.dp, oldKeySig);
      const newStored = storedForSounding(sounding, n.dp, newKeySig);
      return { ...n, accidental: newStored };
    }),
  }));
}

// ── Tonic / Scale options ───────────────────────────────────────────

export const TONIC_OPTIONS = [
  { label: "C", letter: "C", acc: "" },
  { label: "C#", letter: "C", acc: "#" },
  { label: "Db", letter: "D", acc: "b" },
  { label: "D", letter: "D", acc: "" },
  { label: "Eb", letter: "E", acc: "b" },
  { label: "E", letter: "E", acc: "" },
  { label: "F", letter: "F", acc: "" },
  { label: "F#", letter: "F", acc: "#" },
  { label: "Gb", letter: "G", acc: "b" },
  { label: "G", letter: "G", acc: "" },
  { label: "Ab", letter: "A", acc: "b" },
  { label: "A", letter: "A", acc: "" },
  { label: "Bb", letter: "B", acc: "b" },
  { label: "B", letter: "B", acc: "" },
];

export const SCALE_OPTIONS = [
  { label: "Major", value: "major" },
  { label: "Minor", value: "minor" },
  { label: "Dorian", value: "dorian" },
  { label: "Phrygian", value: "phrygian" },
  { label: "Lydian", value: "lydian" },
  { label: "Mixolydian", value: "mixolydian" },
  { label: "Locrian", value: "locrian" },
];

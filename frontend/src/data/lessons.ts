import type { PlacedBeat, Accidental } from "../components/Staff";

export interface Lesson {
  id: string;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  /** Index into TONIC_OPTIONS (0 = C). */
  tonicIdx: number;
  scaleName: string;
  tsTop: number;
  tsBottom: number;
  /** Pre-filled soprano melody on the treble staff. */
  sopranoBeats: PlacedBeat[];
}

/** Helper to make a soprano note at a diatonic position. */
function sn(dp: number, duration: PlacedBeat["duration"], acc: Accidental = ""): PlacedBeat {
  return { notes: [{ dp, staff: "treble" as const, accidental: acc }], duration };
}

/**
 * Lesson 1: Simple chorale harmonization in C major (2 measures, 4/4).
 *
 * Soprano melody:
 *   M1: C5 - D5 - E5 - D5
 *   M2: E5 - D5 - B4 - C5   (B4 resolves up to C5 ✓)
 *
 * Diatonic positions: B4=34, C5=35, D5=36, E5=37
 */
export const lessons: Lesson[] = [
  {
    id: "harmonize-1",
    title: "Harmonize a Melody",
    description:
      "Add alto, tenor, and bass voices to complete this 4-part chorale in C major. Avoid part-writing errors and label each chord with roman numerals.",
    difficulty: "beginner",
    tonicIdx: 0, // C
    scaleName: "major",
    tsTop: 4,
    tsBottom: 4,
    sopranoBeats: [
      // Measure 1
      sn(35, "quarter"), // C5
      sn(36, "quarter"), // D5
      sn(37, "quarter"), // E5
      sn(36, "quarter"), // D5
      // Measure 2
      sn(37, "quarter"), // E5
      sn(36, "quarter"), // D5
      sn(34, "quarter"), // B4  → resolves up to C5
      sn(35, "quarter"), // C5
    ],
  },
];

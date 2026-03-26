import type React from "react";

export type Duration = "whole" | "half" | "quarter" | "eighth" | "sixteenth";

/** A beat contains one or more notes (a chord) with a shared duration. */
export type Accidental = "" | "n" | "#" | "b";

export interface PlacedNote {
  dp: number;
  staff: "treble" | "bass";
  accidental: Accidental;
}

export interface PlacedBeat {
  notes: PlacedNote[];
  duration: Duration;
  dotted?: boolean;
  isRest?: boolean;
}

export interface LessonErrorItem {
  beat: number;
  measure: number;
  beatInMeasure: number;
  label: string;
  fullName: string;
  location: string;
}

export interface LessonConfig {
  /** Pre-filled soprano melody on the treble staff (locked, not editable). */
  lockedTrebleBeats: PlacedBeat[];
  /** Pre-filled bass line (locked, not editable). Used by figured_bass template. */
  lockedBassBeats?: PlacedBeat[];
  /** Figured bass figures per beat index. Displayed above the RN input area. */
  figuredBass?: string[][];
  /** Key: index into TONIC_OPTIONS. */
  tonicIdx: number;
  /** Scale name (e.g. "major", "minor"). */
  scaleName: string;
  /** Time signature. */
  tsTop: number;
  tsBottom: number;
  /** Called whenever error summary recomputes. */
  onErrorsComputed?: (errors: LessonErrorItem[]) => void;
  /** Called whenever computed roman numerals change. */
  onRomansComputed?: (romans: string[][]) => void;
  /** Called whenever student RN entries change. */
  onStudentRomansChanged?: (studentRomans: Record<number, string>) => void;
  /** Called whenever beat state changes — reports treble and bass beats. */
  onBeatsChanged?: (treble: PlacedBeat[], bass: PlacedBeat[]) => void;
  /** When true, show computed RN labels, NCT markers, and error markers on the score. */
  checked?: boolean;
  /** Pre-populate student roman numeral entries (e.g. from a saved draft). */
  initialStudentRomans?: Record<number, string>;
  /** When true (with checked), show student-submitted RN labels instead of computed ones. */
  showStudentRomans?: boolean;
}

export interface NoteEditorProps {
  header?: React.ReactNode;
  lessonConfig?: LessonConfig;
  /** Called whenever treble beats change (used by admin melody editor). */
  onTrebleBeatsChanged?: (beats: PlacedBeat[]) => void;
  /** Called whenever bass beats change (used by admin figured bass editor). */
  onBassBeatsChanged?: (beats: PlacedBeat[]) => void;
  /** Current figured bass figures per beat index (admin editor). */
  figuredBassValues?: string[][];
  /** Called when figured bass input changes (admin editor). */
  onFiguredBassChanged?: (fb: string[][]) => void;
  /** If true, hide bass staff and only allow treble editing. */
  trebleOnly?: boolean;
  /** Override initial tonic index. */
  initialTonicIdx?: number;
  /** Override initial scale name. */
  initialScaleName?: string;
  /** Override initial time signature top. */
  initialTsTop?: number;
  /** Override initial time signature bottom. */
  initialTsBottom?: number;
  /** Pre-populate treble beats (used when editing an existing lesson). */
  initialTrebleBeats?: PlacedBeat[];
  /** Pre-populate bass beats (used when editing an existing figured bass lesson). */
  initialBassBeats?: PlacedBeat[];
  /** If true, disable all editing interactions (note placement, toolbar, RN inputs). */
  readOnly?: boolean;
}

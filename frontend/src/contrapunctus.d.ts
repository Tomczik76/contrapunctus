/** A note as passed into the Scala.js library. */
export interface JsNote {
  readonly letter: string;
  readonly accidental: string;
  readonly octave: number;
}

/** A beat (chord or single note) as passed into the library. */
export interface JsBeat {
  readonly notes: JsNote[];
}

/** Time signature. */
export interface JsTimeSignature {
  readonly top: number;
  readonly bottom: number;
}

/** A measure as passed into the library. */
export interface JsMeasure {
  readonly timeSignature: JsTimeSignature;
  readonly beats: JsBeat[];
}

/** A rendered note with layout information. */
export interface NoteRender {
  readonly letter: string;
  readonly accidental: string;
  readonly octave: number;
  /** Vertical staff position: octave * 7 + letterIndex (C=0..B=6). C4 = 28. */
  readonly diatonicPosition: number;
  readonly midi: number;
  /** Which staff this note is assigned to. */
  readonly staff: "treble" | "bass";
}

/** A rendered beat with its notes and duration. */
export interface BeatRender {
  readonly notes: NoteRender[];
  /** Duration as [numerator, denominator] fraction of a whole note. */
  readonly durationFraction: [number, number];
  readonly isRest: boolean;
  readonly romanNumerals: string[];
}

/** A rendered measure. */
export interface MeasureRender {
  readonly timeSignature: JsTimeSignature;
  readonly beats: BeatRender[];
}

/** Staff descriptor. */
export interface Staff {
  readonly clef: "treble" | "bass";
  /** Diatonic positions of the five staff lines. */
  readonly lines: number[];
}

/** Full rendering data returned by Contrapunctus.render(). */
export interface RenderData {
  readonly staves: Staff[];
  readonly measures: MeasureRender[];
}

export interface ContrapunctusApi {
  note(letter: string, accidental: string, octave: number): JsNote;
  beat(notes: JsNote[]): JsBeat;
  rest(): JsBeat;
  measure(top: number, bottom: number, beats: JsBeat[]): JsMeasure;
  render(measures: JsMeasure[]): RenderData;
  renderWithAnalysis(
    measures: JsMeasure[],
    tonicLetter: string,
    tonicAccidental: string,
    scaleName: string
  ): RenderData;
}

declare const Contrapunctus: ContrapunctusApi;
export { Contrapunctus };

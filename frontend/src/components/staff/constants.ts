// ── Layout constants ─────────────────────────────────────────────────

/** Vertical pixels per diatonic step (half a staff space). */
export const STEP = 6;
/** One staff space (distance between adjacent lines) = 2 diatonic steps. */
export const SPACE = STEP * 2;
/** Horizontal space per quarter note. */
export const BEAT_WIDTH = 60;
/** Where clef + time signature live. */
export const CLEF_WIDTH = 44;
export const TS_WIDTH = 24;
/** Left margin: clef area + time sig + small gap before first note. */
export const LEFT_MARGIN = CLEF_WIDTH + TS_WIDTH + 10;
/** Right margin after last note. */
export const RIGHT_MARGIN = 20;
/** Gap between treble and bass staves in a grand staff. */
export const STAFF_GAP = 120;
/** Staff line thickness. */
export const LINE_W = 1;
/** Ledger line half-width. */
export const LEDGER_HW = 8;
/** Stem length in pixels (VexFlow default is 35 at 10px spacing). */
export const STEM_HEIGHT = 35 * (SPACE / 10);
/** Stem thickness. */
export const STEM_W = 1.5;
/** Vertical gap between systems (rows of staves). */
export const SYSTEM_GAP_V = 20;

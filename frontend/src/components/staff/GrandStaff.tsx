import type { RenderData, NoteRender, BeatRender, Staff as StaffDef } from "../../contrapunctus";
import {
  CLEF_WIDTH, TS_WIDTH, LEFT_MARGIN, RIGHT_MARGIN, STAFF_GAP,
  LINE_W, LEDGER_HW, STEM_HEIGHT, STEM_W, SPACE, BEAT_WIDTH, STEP,
} from "./constants";
import {
  TREBLE_CLEF_PATH, BASS_CLEF_PATH, GLYPH_SCALE, TS_DIGIT_GLYPHS,
  vexOutlineToSvgPath, NOTEHEAD_WHOLE, NOTEHEAD_HALF, NOTEHEAD_BLACK,
  FLAG_8TH_UP, FLAG_8TH_DOWN, FLAG_16TH_UP, FLAG_16TH_DOWN,
} from "./glyphs";
import { dpToY, accidentalSymbol, middleLine, durationCategory } from "./musicTheory";

// ── Staff component ─────────────────────────────────────────────────

interface StaffProps {
  data: RenderData;
}

export function GrandStaff({ data }: StaffProps) {
  const { staves, measures } = data;
  const treble = staves.find((s) => s.clef === "treble");
  const bass = staves.find((s) => s.clef === "bass");

  const allDps: number[] = measures.flatMap((m) =>
    m.beats.flatMap((b) => b.notes.map((n) => n.diatonicPosition))
  );
  const minDp = allDps.length > 0 ? Math.min(...allDps) : 18;
  const maxDp = allDps.length > 0 ? Math.max(...allDps) : 38;

  const trebleTopDp = treble ? treble.lines[treble.lines.length - 1] : 38;
  const trebleBotDp = treble ? treble.lines[0] : 30;
  const bassTopDp = bass ? bass.lines[bass.lines.length - 1] : 26;
  const bassBotDp = bass ? bass.lines[0] : 18;

  const highestDp = treble
    ? Math.max(trebleTopDp + 2, maxDp + 1)
    : Math.max(bassTopDp + 2, maxDp + 1);
  const lowestDp = bass
    ? Math.min(bassBotDp - 2, minDp - 1)
    : treble
      ? Math.min(trebleBotDp - 2, minDp - 1)
      : Math.min(bassBotDp - 2, minDp - 1);

  const trebleYOffset = treble ? (highestDp - trebleTopDp) * STEP : 0;
  const bassYOffset = treble
    ? trebleYOffset + (trebleTopDp - trebleBotDp) * STEP + STAFF_GAP
    : (highestDp - bassTopDp) * STEP;

  // Check if any beat has a Roman numeral
  const hasRomanNumerals = measures.some((m) =>
    m.beats.some((b) => b.romanNumerals && b.romanNumerals.length > 0)
  );
  const RN_SPACE = hasRomanNumerals ? 24 : 0;

  const height = (bass
    ? bassYOffset + (bassTopDp - lowestDp) * STEP + STEP * 2
    : treble
      ? trebleYOffset + (trebleTopDp - lowestDp) * STEP + STEP * 2
      : 200) + RN_SPACE;

  // Build beat x-positions
  let beatX = LEFT_MARGIN;
  const beatPositions: { x: number; beat: BeatRender; measureIdx: number }[] = [];
  const barlineXs: number[] = [];

  for (let mi = 0; mi < measures.length; mi++) {
    const m = measures[mi];
    for (const beat of m.beats) {
      const [num, den] = beat.durationFraction;
      const fraction = num / den;
      const w = fraction * 4 * BEAT_WIDTH;
      beatPositions.push({ x: beatX + 20, beat, measureIdx: mi });
      beatX += w;
    }
    if (mi < measures.length - 1) {
      barlineXs.push(beatX);
      beatX += 4;
    }
  }

  const totalWidth = beatX + RIGHT_MARGIN;
  const staffStartX = 5;

  return (
    <svg
      width={totalWidth}
      height={height}
      viewBox={`0 0 ${totalWidth} ${height}`}
      style={{ fontFamily: "serif" }}
    >
      {/* Staff lines */}
      {treble && (
        <StaffLines staff={treble} yOffset={trebleYOffset} startX={staffStartX} endX={totalWidth - RIGHT_MARGIN} />
      )}
      {bass && (
        <StaffLines staff={bass} yOffset={bassYOffset} startX={staffStartX} endX={totalWidth - RIGHT_MARGIN} />
      )}

      {/* Clefs */}
      {treble && (
        <GlyphClef
          path={TREBLE_CLEF_PATH}
          lineDp={32}
          staffTopDp={trebleTopDp}
          yOffset={trebleYOffset}
          x={12}
        />
      )}
      {bass && (
        <GlyphClef
          path={BASS_CLEF_PATH}
          lineDp={24}
          staffTopDp={bassTopDp}
          yOffset={bassYOffset}
          x={12}
        />
      )}

      {/* Time signatures */}
      {measures.length > 0 && (
        <>
          {treble && (
            <TimeSignature
              top={measures[0].timeSignature.top}
              bottom={measures[0].timeSignature.bottom}
              x={CLEF_WIDTH + TS_WIDTH / 2}
              staff={treble}
              yOffset={trebleYOffset}
            />
          )}
          {bass && (
            <TimeSignature
              top={measures[0].timeSignature.top}
              bottom={measures[0].timeSignature.bottom}
              x={CLEF_WIDTH + TS_WIDTH / 2}
              staff={bass}
              yOffset={bassYOffset}
            />
          )}
        </>
      )}

      {/* Barlines */}
      {barlineXs.map((x, i) => {
        const { topY, botY } = getBarlineEnds(treble, bass, trebleTopDp, trebleBotDp, bassTopDp, bassBotDp, trebleYOffset, bassYOffset);
        return <line key={`bar-${i}`} x1={x} y1={topY} x2={x} y2={botY} stroke="currentColor" strokeWidth={LINE_W} />;
      })}

      {/* Final double barline */}
      {(() => {
        const { topY, botY } = getBarlineEnds(treble, bass, trebleTopDp, trebleBotDp, bassTopDp, bassBotDp, trebleYOffset, bassYOffset);
        return (
          <>
            <line x1={beatX - 4} y1={topY} x2={beatX - 4} y2={botY} stroke="currentColor" strokeWidth={LINE_W} />
            <line x1={beatX} y1={topY} x2={beatX} y2={botY} stroke="currentColor" strokeWidth={2.5} />
          </>
        );
      })()}

      {/* Notes */}
      {beatPositions.map(({ x, beat }, i) => {
        if (beat.isRest) return null;
        // Compute reversed noteheads for seconds within each staff group
        const trebleNotesInBeat = beat.notes.filter(n => n.staff === "treble").sort((a, b) => a.diatonicPosition - b.diatonicPosition);
        const bassNotesInBeat = beat.notes.filter(n => n.staff === "bass").sort((a, b) => a.diatonicPosition - b.diatonicPosition);
        const [num, den] = beat.durationFraction;
        const dur = durationCategory(num / den);
        const head = dur === "whole" ? NOTEHEAD_WHOLE : dur === "half" ? NOTEHEAD_HALF : NOTEHEAD_BLACK;
        const headW = (head.outlineXMax - head.outlineXMin) * GLYPH_SCALE;
        const trebleStemDown = treble ? trebleNotesInBeat.length > 0 && (trebleNotesInBeat.reduce((a, b) => a + b.diatonicPosition, 0) / trebleNotesInBeat.length) >= middleLine(treble) : false;
        const bassStemDown = bass ? bassNotesInBeat.length > 0 && (bassNotesInBeat.reduce((a, b) => a + b.diatonicPosition, 0) / bassNotesInBeat.length) >= middleLine(bass) : false;
        const trebleOffsets = computeSecondOffsets(trebleNotesInBeat.map(n => n.diatonicPosition), trebleStemDown, headW);
        const bassOffsets = computeSecondOffsets(bassNotesInBeat.map(n => n.diatonicPosition), bassStemDown, headW);
        const noteOffsets = new Map<NoteRender, number>();
        trebleNotesInBeat.forEach((n, idx) => { if (trebleOffsets[idx]) noteOffsets.set(n, trebleOffsets[idx]); });
        bassNotesInBeat.forEach((n, idx) => { if (bassOffsets[idx]) noteOffsets.set(n, bassOffsets[idx]); });

        return (
          <g key={`beat-${i}`}>
            {beat.notes.map((note, ni) => {
              const staffDef = note.staff === "treble" ? treble : bass;
              if (!staffDef) return null;
              const topDp = staffDef.lines[staffDef.lines.length - 1];
              const yOff = note.staff === "treble" ? trebleYOffset : bassYOffset;
              return (
                <NoteHead
                  key={`note-${i}-${ni}`}
                  note={note}
                  x={x}
                  staffTopDp={topDp}
                  staffBotDp={staffDef.lines[0]}
                  yOffset={yOff}
                  durationFraction={beat.durationFraction}
                  staffMiddleDp={middleLine(staffDef)}
                  xOffset={noteOffsets.get(note) ?? 0}
                />
              );
            })}
          </g>
        );
      })}

      {/* Roman numerals */}
      {hasRomanNumerals && beatPositions.map(({ x, beat }, i) => {
        if (!beat.romanNumerals || beat.romanNumerals.length === 0) return null;
        const rnY = height - RN_SPACE + 16;
        return (
          <text
            key={`rn-${i}`}
            x={x}
            y={rnY}
            fontSize={14}
            fontStyle="normal"
            textAnchor="middle"
            fill="currentColor"
            fontFamily="serif"
          >
            {beat.romanNumerals[0]}
          </text>
        );
      })}
    </svg>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Compute x-offsets for noteheads in a chord to avoid overlap on seconds.
 * In clusters of consecutive seconds, noteheads alternate between two columns:
 * odd positions (1st, 3rd, 5th from bottom) go LEFT, even positions (2nd, 4th) go RIGHT.
 * For stem up, LEFT = normal, RIGHT = +headW.
 * For stem down, RIGHT = normal, LEFT = -headW.
 */
function computeSecondOffsets(dps: number[], stemDown: boolean, headW: number): number[] {
  const offsets = new Array(dps.length).fill(0);
  const displacement = headW - 2;
  let i = 0;
  while (i < dps.length) {
    let j = i;
    while (j + 1 < dps.length && dps[j + 1] - dps[j] === 1) j++;
    if (j > i) {
      for (let k = i; k <= j; k++) {
        const pos = k - i;
        if (stemDown) {
          if (pos % 2 === 0) offsets[k] = -displacement;
        } else {
          if (pos % 2 === 1) offsets[k] = displacement;
        }
      }
    }
    i = j + 1;
  }
  return offsets;
}

// ── Sub-components ──────────────────────────────────────────────────

function StaffLines({ staff, yOffset, startX, endX }: {
  staff: StaffDef; yOffset: number; startX: number; endX: number;
}) {
  const topDp = staff.lines[staff.lines.length - 1];
  return (
    <>
      {staff.lines.map((dp) => {
        const y = dpToY(dp, topDp, yOffset);
        return <line key={`line-${dp}`} x1={startX} y1={y} x2={endX} y2={y} stroke="currentColor" strokeWidth={LINE_W} />;
      })}
    </>
  );
}

/** Render a clef glyph from Bravura font paths.
 *  The glyph origin is placed at the reference line (G4 for treble, F3 for bass).
 *  scale(s, -s) flips Y since glyph coordinates have Y pointing up.
 */
function GlyphClef({ path, lineDp, staffTopDp, yOffset, x }: {
  path: string; lineDp: number; staffTopDp: number; yOffset: number; x: number;
}) {
  const lineY = dpToY(lineDp, staffTopDp, yOffset);
  const s = GLYPH_SCALE;
  return (
    <path
      d={path}
      fill="currentColor"
      stroke="none"
      transform={`translate(${x}, ${lineY}) scale(${s}, ${-s})`}
    />
  );
}

/** Render a single time-signature digit as a Bravura glyph. */
function TsDigit({ digit, x, y }: { digit: number; x: number; y: number }) {
  const digits = String(digit).split("").map(Number);
  if (digits.length === 1) {
    const g = TS_DIGIT_GLYPHS[digits[0]];
    if (!g) return null;
    const path = vexOutlineToSvgPath(g.o);
    const s = GLYPH_SCALE;
    const cx = x - ((g.x_min + g.x_max) / 2) * s;
    return (
      <path d={path} fill="currentColor" stroke="none"
        transform={`translate(${cx}, ${y}) scale(${s}, ${-s})`} />
    );
  }
  // Multi-digit: compute total width, center the group
  const s = GLYPH_SCALE;
  const glyphs = digits.map((d) => TS_DIGIT_GLYPHS[d]).filter(Boolean);
  const totalW = glyphs.reduce((sum, g) => sum + (g.x_max - g.x_min) * s, 0);
  const gap = 2;
  const totalWithGaps = totalW + (glyphs.length - 1) * gap;
  let cx = x - totalWithGaps / 2;
  return (
    <g>
      {glyphs.map((g, i) => {
        const path = vexOutlineToSvgPath(g.o);
        const gx = cx - g.x_min * s;
        cx += (g.x_max - g.x_min) * s + gap;
        return (
          <path key={i} d={path} fill="currentColor" stroke="none"
            transform={`translate(${gx}, ${y}) scale(${s}, ${-s})`} />
        );
      })}
    </g>
  );
}

function TimeSignature({ top, bottom, x, staff, yOffset }: {
  top: number; bottom: number; x: number; staff: StaffDef; yOffset: number;
}) {
  const topDp = staff.lines[staff.lines.length - 1];
  const topLineY = dpToY(staff.lines[4], topDp, yOffset);
  const midLineY = dpToY(staff.lines[2], topDp, yOffset);
  const botLineY = dpToY(staff.lines[0], topDp, yOffset);
  // Center each number between line pairs
  const topCenterY = (topLineY + midLineY) / 2;
  const botCenterY = (midLineY + botLineY) / 2;

  return (
    <>
      <TsDigit digit={top} x={x} y={topCenterY} />
      <TsDigit digit={bottom} x={x} y={botCenterY} />
    </>
  );
}

function getBarlineEnds(
  treble: StaffDef | undefined, bass: StaffDef | undefined,
  trebleTopDp: number, trebleBotDp: number,
  bassTopDp: number, bassBotDp: number,
  trebleYOffset: number, bassYOffset: number,
): { topY: number; botY: number } {
  const topY = treble
    ? dpToY(trebleTopDp, trebleTopDp, trebleYOffset)
    : dpToY(bassTopDp, bassTopDp, bassYOffset);
  const botY = bass
    ? dpToY(bassBotDp, bassTopDp, bassYOffset)
    : dpToY(trebleBotDp, trebleTopDp, trebleYOffset);
  return { topY, botY };
}

function NoteHead({ note, x, staffTopDp, staffBotDp, yOffset, durationFraction, staffMiddleDp, xOffset = 0 }: {
  note: NoteRender; x: number; staffTopDp: number; staffBotDp: number;
  yOffset: number; durationFraction: [number, number]; staffMiddleDp: number; xOffset?: number;
}) {
  const dp = note.diatonicPosition;
  const y = dpToY(dp, staffTopDp, yOffset);
  const [num, den] = durationFraction;
  const fraction = num / den;
  const dur = durationCategory(fraction);
  const s = GLYPH_SCALE;

  // Select notehead glyph
  const head = dur === "whole" ? NOTEHEAD_WHOLE
    : dur === "half" ? NOTEHEAD_HALF
    : NOTEHEAD_BLACK;

  // Notehead width in pixels (from actual outline bounds)
  const headW = (head.outlineXMax - head.outlineXMin) * s;
  // Center notehead horizontally on x, applying offset for seconds
  const nx = x + xOffset;
  const headX = nx - headW / 2 - head.outlineXMin * s;

  const stemDown = dp >= staffMiddleDp;
  const hasStem = dur !== "whole";
  const hasFlag = dur === "eighth" || dur === "sixteenth";

  // Stem attaches at metric edges: left body edge (stem down) or right body edge (stem up)
  const stemLeft = (head.outlineXMax - head.stemRight) * s;
  const stemX = stemDown ? x - headW / 2 + stemLeft : x - headW / 2 + head.stemRight * s;
  const stemEndY = stemDown ? y + STEM_HEIGHT : y - STEM_HEIGHT;

  // Ledger lines
  const ledgers: number[] = [];
  if (dp < staffBotDp) {
    for (let p = staffBotDp - 2; p >= dp; p -= 2) {
      if (p % 2 === 0) ledgers.push(p);
    }
  } else if (dp > staffTopDp) {
    for (let p = staffTopDp + 2; p <= dp; p += 2) {
      if (p % 2 === 0) ledgers.push(p);
    }
  }

  const accSym = accidentalSymbol(note.accidental);

  // Select flag glyph
  let flagPath: string | null = null;
  if (hasFlag) {
    if (dur === "eighth") {
      flagPath = stemDown ? FLAG_8TH_DOWN.path : FLAG_8TH_UP.path;
    } else {
      flagPath = stemDown ? FLAG_16TH_DOWN.path : FLAG_16TH_UP.path;
    }
  }

  return (
    <g>
      {/* Ledger lines */}
      {ledgers.map((ldp) => {
        const ly = dpToY(ldp, staffTopDp, yOffset);
        return <line key={`ledger-${ldp}`} x1={nx - LEDGER_HW} y1={ly} x2={nx + LEDGER_HW} y2={ly} stroke="currentColor" strokeWidth={LINE_W} />;
      })}

      {/* Accidental */}
      {accSym && (
        <text x={nx - headW / 2 - 1} y={y + (accSym === "\u266D" ? 4 : 6)} fontSize={accSym === "\u266E" ? 17 : 16} textAnchor="end"
          fill="currentColor" stroke="currentColor" strokeWidth={0.5} paintOrder="stroke">
          {accSym}
        </text>
      )}

      {/* Notehead glyph */}
      <path
        d={head.path}
        fill="currentColor"
        stroke="none"
        transform={`translate(${headX}, ${y}) scale(${s}, ${-s})`}
      />

      {/* Stem */}
      {hasStem && (
        <line x1={stemX} y1={y} x2={stemX} y2={stemEndY} stroke="currentColor" strokeWidth={STEM_W} />
      )}

      {/* Flag */}
      {flagPath && (
        <path
          d={flagPath}
          fill="currentColor"
          stroke="none"
          transform={`translate(${stemX}, ${stemEndY}) scale(${s}, ${-s})`}
        />
      )}
    </g>
  );
}

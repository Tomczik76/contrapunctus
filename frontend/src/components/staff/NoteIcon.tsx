import {
  NOTEHEAD_WHOLE, NOTEHEAD_HALF, NOTEHEAD_BLACK,
  FLAG_8TH_UP, FLAG_16TH_UP,
} from "./glyphs";
import type { Duration } from "./types";

/** Small SVG icon of a note for the duration picker buttons. */
export function NoteIcon({ duration, size }: { duration: Duration; size: number }) {
  const gs = 0.022; // glyph-to-virtual scale
  const head = duration === "whole" ? NOTEHEAD_WHOLE
    : duration === "half" ? NOTEHEAD_HALF
    : NOTEHEAD_BLACK;
  const headW = (head.outlineXMax - head.outlineXMin) * gs;
  const headH = 8;
  const hasStem = duration !== "whole";
  const hasFlag = duration === "eighth" || duration === "sixteenth";
  const stemLen = hasStem ? 19 : 0;
  const stemW = 0.8;

  // Fixed viewBox — all icons same size
  const vw = 18;
  const vh = 30;

  // Notehead always at the same vertical position (near bottom)
  const headCy = vh - headH / 2 - 1;
  const headCx = hasStem ? vw / 2 - 1 : vw / 2;
  const headX = headCx - headW / 2 - head.outlineXMin * gs;

  const stemX = headCx - headW / 2 + head.stemRight * gs;
  const stemTop = headCy - stemLen;

  return (
    <svg width={size * (vw / vh)} height={size} viewBox={`0 0 ${vw} ${vh}`}>
      <path d={head.path} fill="currentColor" stroke="none"
        transform={`translate(${headX}, ${headCy}) scale(${gs}, ${-gs})`} />
      {hasStem && (
        <line x1={stemX} y1={headCy} x2={stemX} y2={stemTop}
          stroke="currentColor" strokeWidth={stemW} />
      )}
      {hasFlag && (() => {
        const flagPath = duration === "eighth" ? FLAG_8TH_UP.path : FLAG_16TH_UP.path;
        return (
          <path d={flagPath} fill="currentColor" stroke="none"
            transform={`translate(${stemX}, ${stemTop}) scale(${gs}, ${-gs})`} />
        );
      })()}
    </svg>
  );
}

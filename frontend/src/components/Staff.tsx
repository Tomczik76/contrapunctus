import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { RenderData, NoteRender, BeatRender, Staff as StaffDef, ContrapunctusApi } from "../contrapunctus";
import { Contrapunctus } from "contrapunctus";
import { useAuth, API_BASE } from "../auth";
import * as Tone from "tone";

const C = Contrapunctus as ContrapunctusApi;

// ── Layout constants ─────────────────────────────────────────────────

/** Vertical pixels per diatonic step (half a staff space). */
const STEP = 6;
/** One staff space (distance between adjacent lines) = 2 diatonic steps. */
const SPACE = STEP * 2;
/** Horizontal space per quarter note. */
const BEAT_WIDTH = 60;
/** Where clef + time signature live. */
const CLEF_WIDTH = 44;
const TS_WIDTH = 24;
/** Left margin: clef area + time sig + small gap before first note. */
const LEFT_MARGIN = CLEF_WIDTH + TS_WIDTH + 10;
/** Right margin after last note. */
const RIGHT_MARGIN = 20;
/** Gap between treble and bass staves in a grand staff. */
const STAFF_GAP = 120;
/** Staff line thickness. */
const LINE_W = 1;
/** Ledger line half-width. */
const LEDGER_HW = 8;
/** Stem length in pixels (VexFlow default is 35 at 10px spacing). */
const STEM_HEIGHT = 35 * (SPACE / 10);
/** Stem thickness. */
const STEM_W = 1.5;
/** Vertical gap between systems (rows of staves). */
const SYSTEM_GAP_V = 20;

// ── Bravura glyph outlines (from VexFlow / SMuFL) ───────────────────
// VexFlow outline format: "m x y", "l x y", "q endX endY cpX cpY",
//   "b endX endY cp1X cp1Y cp2X cp2Y", "z"
// Note: bezier/quadratic have endpoint FIRST, then control points.
// We convert to SVG path format where control points come first.

/** Convert VexFlow outline string to SVG path string.
 *  VexFlow bezier: b endX endY cp1X cp1Y cp2X cp2Y
 *  SVG cubic:      C cp1X cp1Y cp2X cp2Y endX endY
 */
function vexOutlineToSvgPath(outline: string): string {
  const tokens = outline.split(/\s+/);
  const parts: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case "m":
        parts.push(`M ${tokens[i++]} ${tokens[i++]}`);
        break;
      case "l":
        parts.push(`L ${tokens[i++]} ${tokens[i++]}`);
        break;
      case "q": {
        // VexFlow: q endX endY cpX cpY → SVG: Q cpX cpY endX endY
        const ex = tokens[i++], ey = tokens[i++];
        const cx = tokens[i++], cy = tokens[i++];
        parts.push(`Q ${cx} ${cy} ${ex} ${ey}`);
        break;
      }
      case "b": {
        // VexFlow: b endX endY cp1X cp1Y cp2X cp2Y → SVG: C cp1X cp1Y cp2X cp2Y endX endY
        const ex = tokens[i++], ey = tokens[i++];
        const c1x = tokens[i++], c1y = tokens[i++];
        const c2x = tokens[i++], c2y = tokens[i++];
        parts.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`);
        break;
      }
      case "z":
        parts.push("Z");
        break;
    }
  }
  return parts.join(" ");
}

const TREBLE_CLEF_PATH = vexOutlineToSvgPath(
  "m 541 598 b 550 625 539 615 541 616 b 824 1174 706 770 824 953" +
  " b 730 1509 824 1299 789 1423 b 655 1581 708 1541 671 1581" +
  " b 562 1512 635 1581 590 1544 b 420 1064 455 1394 420 1214" +
  " b 441 828 420 981 431 887 b 428 793 444 811 445 808" +
  " b 0 125 220 622 0 416 b 524 -363 0 -125 171 -363" +
  " b 624 -354 557 -363 595 -360 b 645 -367 639 -351 642 -350" +
  " b 684 -657 662 -464 684 -589 b 455 -896 684 -870 540 -896" +
  " b 340 -854 377 -896 340 -873 b 386 -829 340 -844 353 -840" +
  " b 482 -694 431 -816 482 -778 b 344 -547 482 -615 432 -547" +
  " b 190 -713 248 -547 190 -624 b 464 -948 190 -806 246 -948" +
  " b 747 -660 560 -948 747 -904 b 706 -351 747 -577 721 -441" +
  " b 724 -327 703 -334 704 -336 b 966 16 870 -269 966 -147" +
  " b 619 363 966 200 831 363 b 577 389 582 363 582 363 z" +
  " m 677 1358 b 763 1240 724 1358 763 1319" +
  " b 513 851 763 1080 626 950 b 494 863 503 842 497 844" +
  " b 485 995 488 900 485 949 b 677 1358 485 1220 589 1358 z" +
  " m 520 377 b 498 343 524 350 524 351" +
  " b 289 63 372 300 289 186 b 455 -192 289 -66 357 -158" +
  " b 494 -200 467 -196 484 -200 b 511 -184 505 -200 511 -193" +
  " b 490 -166 511 -174 500 -170 b 386 -12 429 -140 386 -78" +
  " b 530 157 386 71 442 132 b 559 145 553 163 556 161" +
  " l 631 -284 b 611 -304 634 -300 632 -300" +
  " b 530 -311 588 -308 559 -311 b 115 29 278 -311 115 -171" +
  " b 249 363 115 114 130 228 b 469 567 336 459 402 513" +
  " b 490 562 484 579 487 577 z" +
  " m 619 148 b 635 168 616 166 618 170" +
  " b 848 -66 752 158 848 60 b 713 -271 848 -157 793 -230" +
  " b 690 -262 696 -279 693 -279 z"
);

const BASS_CLEF_PATH = vexOutlineToSvgPath(
  "m 363 377 b 0 56 112 377 0 194 b 177 -158 0 -59 60 -158" +
  " b 330 -6 268 -158 330 -95 b 192 144 330 86 262 144" +
  " b 120 134 153 144 138 134 b 96 160 101 134 96 145" +
  " b 330 323 96 217 183 323 b 549 -53 482 323 549 173" +
  " b 14 -871 549 -455 350 -680 b -7 -897 1 -878 -7 -886" +
  " b 12 -914 -7 -906 -1 -914 b 36 -907 19 -914 27 -912" +
  " b 765 -40 390 -734 765 -478 b 363 377 765 210 612 377 z" +
  " m 906 259 b 827 180 861 259 827 225" +
  " b 906 101 827 135 861 101 b 985 180 950 101 985 135" +
  " b 906 259 985 225 950 259 z" +
  " m 907 -102 b 829 -180 863 -102 829 -135" +
  " b 907 -258 829 -225 863 -258 b 985 -180 952 -258 985 -225" +
  " b 907 -102 985 -135 952 -102 z"
);

// VexFlow effective scale at 10px staff spacing is ~0.0253 (empirically verified
// from VexFlow SVG output). Scaled proportionally for our staff spacing.
const GLYPH_SCALE = 0.0253 * (SPACE / 10);

// ── Time signature digit glyphs (Bravura / SMuFL) ──────────────────
// VexFlow uses the same NOTATION_FONT_SCALE for time sig digits as for clefs.

const TS_DIGIT_GLYPHS: Record<number, { o: string; x_min: number; x_max: number }> = {
  0: { x_min: 20, x_max: 450, o: 'm 648 0 b 338 361 648 200 510 361 b 29 0 167 361 29 200 b 338 -360 29 -199 167 -360 b 648 0 510 -360 648 -199 z m 338 317 b 446 10 397 317 446 180 b 338 -295 446 -158 397 -295 b 230 10 278 -295 230 -158 b 338 317 230 180 278 317 z' },
  1: { x_min: 20, x_max: 314, o: 'm 35 19 b 29 0 35 19 29 10 b 45 -20 29 -7 33 -16 b 58 -23 50 -22 56 -23 b 78 -10 72 -23 78 -10 b 156 117 78 -10 140 89 b 170 131 161 127 167 131 b 179 111 176 131 179 120 l 179 -261 b 115 -315 179 -294 145 -315 b 91 -337 105 -315 91 -320 b 122 -360 91 -353 104 -360 l 429 -360 b 452 -337 452 -360 452 -337 b 431 -315 452 -337 452 -315 b 384 -265 410 -315 384 -289 l 384 328 b 356 361 384 351 376 360 b 281 356 336 361 300 356 b 206 360 253 356 228 357 b 199 361 203 360 200 361 b 173 334 184 361 179 347 z' },
  2: { x_min: 20, x_max: 426, o: 'm 606 -131 b 589 -111 606 -114 599 -111 b 570 -127 577 -111 573 -117 l 569 -128 b 513 -192 554 -164 543 -192 b 488 -187 505 -192 498 -190 b 445 -171 469 -180 459 -179 b 289 -137 416 -160 348 -137 b 236 -145 271 -137 252 -140 b 422 -42 268 -94 390 -50 b 613 147 523 -14 613 27 b 330 366 613 300 464 366 b 69 275 229 366 140 357 b 29 170 45 245 29 209 b 42 108 29 150 33 130 b 160 29 63 63 108 29 b 261 156 248 29 261 120 b 161 275 261 242 161 246 b 275 330 164 295 190 330 b 405 192 403 330 405 233 b 193 -102 405 60 297 -39 b 33 -317 114 -153 58 -223 l 32 -321 b 69 -370 32 -340 48 -370 b 203 -282 101 -370 118 -282 b 410 -360 261 -282 282 -360 b 606 -131 472 -360 583 -354 z' },
  3: { x_min: 20, x_max: 401, o: 'm 307 357 b 301 357 305 357 304 357 l 291 359 b 285 359 289 359 287 359 b 37 200 161 359 37 276 b 154 84 37 153 65 89 l 161 84 b 256 177 225 84 256 130 l 256 189 b 209 248 252 242 216 245 b 180 268 202 251 180 248 l 180 274 b 240 310 183 298 228 310 b 374 199 363 310 374 233 l 374 189 b 199 36 374 82 289 40 b 164 12 184 35 164 27 b 200 -6 164 -6 189 -6 b 379 -137 366 -6 379 -118 b 269 -307 379 -289 301 -307 b 256 -305 264 -307 258 -305 b 216 -282 245 -304 217 -304 l 216 -275 b 249 -180 216 -243 248 -222 b 145 -76 249 -120 207 -76 b 130 -78 140 -76 135 -76 b 60 -115 105 -82 78 -96 b 29 -203 36 -137 29 -171 b 275 -361 32 -315 134 -359 l 288 -361 b 577 -161 431 -361 577 -288 l 577 -151 b 537 -50 575 -109 564 -82 b 503 -20 528 -39 517 -29 l 472 -3 l 425 10 b 410 17 418 12 413 12 b 409 24 409 20 409 22 b 415 37 409 30 410 36 b 459 50 431 42 446 43 b 547 181 517 78 547 115 b 307 357 547 314 367 353 z' },
  4: { x_min: 20, x_max: 450, o: 'm 521 -107 l 521 202 b 504 226 521 213 520 226 b 475 213 491 226 484 223 l 338 48 b 325 14 333 40 325 32 l 325 -107 l 131 -107 b 481 336 246 -9 477 318 l 482 340 b 461 361 482 353 472 361 b 363 359 448 361 389 359 b 261 361 337 359 272 361 b 228 334 248 361 228 357 b 43 -105 228 156 86 -45 l 35 -117 b 35 -118 35 -117 35 -118 l 33 -120 b 29 -137 30 -127 29 -132 b 58 -161 29 -151 40 -161 l 325 -161 l 325 -252 b 268 -302 325 -291 294 -302 b 235 -330 245 -302 235 -315 b 262 -360 235 -344 240 -360 l 569 -360 b 598 -330 583 -360 598 -350 b 566 -301 598 -310 580 -301 b 521 -246 552 -301 521 -292 l 521 -161 l 626 -161 b 648 -134 641 -161 648 -151 b 626 -107 648 -117 642 -107 z' },
  5: { x_min: 20, x_max: 383, o: 'm 109 85 b 117 179 109 85 115 166 b 138 197 118 190 125 197 l 144 197 b 285 184 158 194 226 184 b 492 323 485 184 492 300 b 472 353 492 341 488 353 b 295 340 454 353 341 340 b 101 354 249 340 125 351 b 66 330 75 354 68 341 l 50 10 l 50 7 b 79 -14 50 -12 65 -14 b 111 14 94 -14 95 -1 b 209 62 125 29 160 62 b 357 -125 258 62 357 35 b 235 -304 357 -284 272 -304 b 202 -300 223 -304 212 -304 b 184 -279 194 -295 186 -289 b 202 -259 184 -269 194 -264 b 256 -163 235 -239 256 -203 b 144 -50 256 -99 206 -50 b 30 -157 66 -50 35 -107 b 29 -183 29 -166 29 -174 b 284 -361 29 -302 107 -361 b 552 -125 456 -361 552 -255 b 314 112 552 6 445 112 b 122 71 230 112 168 98 b 115 69 120 69 117 69 b 109 79 109 69 109 75 z' },
  6: { x_min: 20, x_max: 414, o: 'm 439 120 b 554 229 500 120 554 167 b 553 245 554 235 554 239 b 348 361 539 337 426 361 b 85 209 239 360 137 307 b 29 4 53 148 29 72 l 29 -1 b 73 -200 30 -68 42 -143 b 324 -359 132 -307 203 -359 b 513 -307 389 -359 461 -348 b 596 -137 563 -266 596 -202 b 379 72 596 -24 490 72 b 248 22 333 72 285 55 b 239 19 245 19 242 19 b 226 53 230 19 226 30 b 346 327 230 320 315 327 b 393 305 374 327 393 320 b 357 251 393 285 366 268 b 347 209 350 238 347 223 b 369 150 347 187 354 166 b 439 120 379 131 420 120 z m 320 3 b 405 -158 366 3 405 -69 b 320 -320 405 -248 366 -320 b 236 -158 274 -320 236 -248 b 320 3 236 -69 274 3 z' },
  7: { x_min: 20, x_max: 421, o: 'm 606 294 b 582 351 606 333 606 351 b 552 336 580 351 557 346 b 485 236 541 318 521 236 b 262 359 449 236 382 359 b 137 307 179 359 157 325 b 98 281 117 288 108 282 b 60 315 86 281 68 301 b 43 325 58 321 50 325 b 29 308 36 325 29 321 l 29 71 b 45 48 29 71 30 48 b 66 76 56 48 60 60 b 164 196 81 112 99 196 b 374 88 222 196 291 88 b 446 118 415 88 435 109 b 459 124 451 121 456 124 b 469 111 465 124 468 120 b 272 -112 469 71 359 -10 b 173 -315 217 -176 173 -259 b 200 -360 173 -346 173 -360 b 294 -347 226 -360 258 -347 b 412 -360 330 -347 397 -360 b 435 -307 426 -360 435 -348 b 606 288 435 -66 606 140 z' },
  8: { x_min: 20, x_max: 416, o: 'm 481 52 b 567 204 533 85 567 132 b 317 373 567 351 356 373 b 36 176 150 373 36 297 b 161 -16 36 76 92 23 b 29 -190 86 -52 29 -99 b 301 -373 29 -315 158 -373 b 599 -117 445 -373 599 -311 b 481 52 599 -30 549 17 z m 406 85 b 168 240 291 125 168 150 b 314 331 168 301 251 331 b 482 207 360 331 482 308 b 406 85 482 150 454 112 z m 295 -325 b 111 -183 199 -325 111 -276 b 225 -48 111 -125 161 -72 b 436 -219 330 -94 436 -124 b 295 -325 436 -276 392 -325 z' },
  9: { x_min: 20, x_max: 414, o: 'm 186 -117 b 71 -226 125 -117 71 -164 b 72 -242 71 -232 71 -236 b 276 -359 86 -334 199 -359 b 540 -206 386 -357 488 -304 b 596 -1 572 -145 596 -69 l 596 4 b 552 203 595 71 583 145 b 301 361 492 310 422 361 b 112 310 236 361 164 351 b 29 140 62 269 29 204 b 246 -69 29 27 135 -69 b 377 -19 292 -69 340 -52 b 386 -16 380 -16 383 -16 b 399 -50 395 -16 399 -27 b 279 -324 395 -317 310 -324 b 232 -302 251 -324 232 -317 b 268 -248 232 -282 259 -265 b 278 -206 275 -235 278 -220 b 256 -147 278 -184 271 -163 b 186 -117 246 -128 204 -117 z m 305 0 b 220 161 259 0 220 72 b 305 323 220 251 259 323 b 389 161 351 323 389 251 b 305 0 389 72 351 0 z' },
};

// ── Notehead glyphs ─────────────────────────────────────────────────
// noteheadWhole: x_min=0, x_max=422 (wider, no stem)
// noteheadHalf:  x_min=0, x_max=295 (hollow, has stem)
// noteheadBlack: x_min=0, x_max=295 (filled, has stem)

// outlineXMin/outlineXMax define the notehead bounds used for centering.
// stemRight is the VexFlow font metric x_max — the stem attachment point for stem-up notes.
const NOTEHEAD_WHOLE = {
  outlineXMin: 0, outlineXMax: 608, stemRight: 400,
  path: vexOutlineToSvgPath('m 311 180 b 0 3 120 180 0 101 b 297 -180 0 -94 82 -180 b 608 3 533 -180 608 -98 b 311 180 608 105 445 180 z m 160 91 b 274 148 176 141 229 148 b 452 -45 373 148 452 42 b 386 -141 452 -89 433 -130 b 341 -147 372 -145 356 -147 b 206 -72 289 -147 236 -112 b 156 56 177 -39 156 10 b 160 91 156 68 157 79 z'),
};

const NOTEHEAD_HALF = {
  outlineXMin: 0, outlineXMax: 425, stemRight: 400,
  path: vexOutlineToSvgPath('m 140 -180 b 425 60 377 -180 425 13 b 282 180 425 134 366 180 b 0 -60 68 180 0 14 b 140 -180 0 -137 60 -180 z m 108 -125 b 50 -92 78 -125 60 -109 b 42 -63 46 -84 42 -73 b 318 121 42 7 251 121 b 372 91 346 121 361 108 b 380 63 376 82 380 73 b 108 -125 380 1 177 -125 z'),
};

const NOTEHEAD_BLACK = {
  outlineXMin: 0, outlineXMax: 425, stemRight: 400,
  path: vexOutlineToSvgPath('m 140 -180 b 425 60 268 -180 425 -62 b 285 180 425 134 367 180 b 0 -60 127 180 0 63 b 140 -180 0 -135 62 -180 z'),
};

// ── Flag glyphs ─────────────────────────────────────────────────────

const FLAG_8TH_UP = {
  path: vexOutlineToSvgPath('m 343 -1138 b 380 -888 343 -1138 380 -1001 b 215 -395 380 -708 305 -539 b 58 -19 141 -281 81 -157 b 27 13 53 4 42 13 b 0 -9 12 13 0 9 l 0 -353 b 284 -688 95 -370 232 -566 b 318 -904 305 -737 318 -819 b 284 -1102 318 -969 308 -1037 b 279 -1123 281 -1110 279 -1117 b 302 -1165 279 -1146 294 -1159 b 343 -1138 311 -1171 336 -1162 z'),
};

const FLAG_8TH_DOWN = {
  path: vexOutlineToSvgPath('m 346 1094 b 376 897 366 1034 376 962 b 318 642 376 812 340 691 b 0 340 265 521 193 405 l 0 1 b 23 -20 0 -13 12 -20 b 58 12 36 -20 55 -12 b 262 387 82 148 189 274 b 441 881 353 530 441 701 b 400 1142 441 994 412 1096 b 377 1164 396 1158 387 1164 b 346 1094 356 1164 331 1136 z'),
};

const FLAG_16TH_UP = {
  path: vexOutlineToSvgPath('m 392 -1146 b 402 -988 397 -1139 402 -1057 l 402 -956 b 360 -783 402 -896 386 -837 b 359 -770 360 -779 359 -776 b 360 -760 359 -768 359 -765 b 396 -577 364 -752 396 -665 b 392 -526 396 -559 395 -543 b 236 -275 377 -428 340 -387 b 53 -16 158 -192 78 -168 b 24 3 50 0 33 3 b 0 -12 16 3 0 -1 l 0 -570 l 7 -570 b 298 -778 96 -573 199 -576 b 344 -992 331 -847 344 -917 b 333 -1120 344 -1034 340 -1077 b 331 -1133 331 -1126 331 -1129 b 363 -1171 331 -1152 343 -1171 b 392 -1146 373 -1171 383 -1165 z m 301 -661 b 223 -562 278 -625 253 -596 b 59 -331 156 -484 89 -449 b 58 -327 58 -330 58 -328 b 78 -312 58 -321 66 -312 l 89 -312 b 302 -464 177 -312 255 -393 b 341 -592 328 -501 341 -546 b 340 -621 341 -602 341 -611 b 330 -658 337 -632 337 -647 b 311 -667 328 -662 318 -667 b 301 -661 307 -667 304 -665 z'),
};

const FLAG_16TH_DOWN = {
  path: vexOutlineToSvgPath('m 346 1132 b 312 768 367 1011 367 880 b 7 559 213 566 96 562 l 0 559 l 0 1 b 24 -13 0 -6 10 -13 b 53 6 35 -13 50 -10 b 406 516 88 228 372 289 b 410 567 409 531 410 549 b 374 750 410 655 379 742 b 373 760 373 753 373 756 b 374 773 373 766 374 769 b 405 1138 426 881 428 1022 b 370 1169 397 1171 387 1169 b 346 1132 353 1168 341 1156 z m 325 657 b 344 647 333 657 343 652 b 354 611 351 636 351 622 b 356 582 356 600 356 590 b 317 454 356 534 343 491 b 89 302 269 383 177 302 l 78 302 b 58 317 66 302 58 310 b 59 321 58 318 58 320 b 238 552 89 439 170 472 b 315 651 268 585 292 613 b 325 657 318 655 321 657 z'),
};

// ── Rest glyphs (Bravura / SMuFL) ──────────────────────────────────

const REST_QUARTER = {
  x_min: 1, x_max: 270, y_min: -375, y_max: 373,
  path: vexOutlineToSvgPath('m 112 -55 b 174 -141 135 -84 156 -111 b 183 -161 177 -147 183 -158 b 181 -167 183 -163 183 -166 b 166 -174 179 -173 173 -174 b 143 -170 160 -174 148 -171 b 137 -170 141 -170 138 -170 l 125 -166 b 1 -304 50 -166 1 -233 b 168 -527 1 -376 63 -446 b 206 -540 180 -536 194 -540 b 228 -531 216 -540 226 -537 b 230 -521 229 -527 230 -524 b 207 -487 230 -508 219 -497 b 170 -435 189 -487 173 -448 b 164 -397 166 -423 164 -410 b 255 -292 164 -338 194 -292 b 369 -317 297 -292 344 -308 l 370 -318 b 382 -320 376 -320 379 -320 b 389 -314 386 -320 389 -318 b 336 -232 389 -297 351 -249 b 236 -32 281 -166 236 -112 b 236 -27 236 -30 236 -29 l 238 -17 b 238 -13 238 -16 238 -14 b 333 199 243 71 295 140 b 338 220 337 206 338 213 b 333 248 338 235 333 248 b 95 526 333 248 120 501 b 69 537 88 533 78 537 b 40 507 55 537 40 527 b 46 484 40 500 42 492 b 134 291 52 468 134 395 b 48 108 134 238 112 176 b 27 66 33 94 27 78 b 42 32 27 46 42 32 z'),
};

const REST_8TH = {
  x_min: 0, x_max: 247, y_min: -251, y_max: 174,
  path: vexOutlineToSvgPath('m 193 154 b 96 251 193 207 150 251 b 0 154 43 251 0 207 b 39 81 0 124 17 98 b 117 56 62 65 89 56 b 173 66 137 56 157 60 b 225 88 193 72 206 78 b 232 89 228 89 230 89 b 239 76 238 89 239 84 b 238 60 239 72 239 66 b 104 -343 233 39 130 -248 b 145 -361 104 -360 137 -361 b 196 -347 161 -361 181 -359 b 341 161 200 -344 341 161 b 356 217 347 187 354 210 b 338 240 356 232 341 239 b 323 235 336 240 331 240 b 193 140 312 226 240 140 z'),
};

const REST_16TH = {
  x_min: 0, x_max: 320, y_min: -500, y_max: 179,
  path: vexOutlineToSvgPath('m 300 160 b 202 258 300 215 256 258 b 104 160 148 258 104 215 b 219 62 104 101 164 62 b 331 94 258 62 298 75 b 341 96 336 95 338 96 b 348 86 346 96 348 94 b 265 -173 348 63 275 -151 b 194 -217 253 -200 215 -217 b 196 -203 196 -212 196 -207 b 98 -105 196 -148 151 -105 b 0 -203 43 -105 0 -148 b 115 -301 0 -262 60 -301 b 223 -271 153 -301 190 -288 b 229 -279 226 -271 229 -274 l 228 -281 b 228 -282 228 -282 228 -282 l 91 -690 b 91 -691 91 -690 91 -691 l 89 -693 b 134 -720 89 -706 102 -720 b 189 -687 176 -720 183 -703 l 356 -138 b 420 81 393 -16 420 81 b 459 226 420 81 456 207 b 461 232 459 229 461 230 b 446 248 461 240 449 246 b 431 242 439 248 435 245 b 300 145 420 233 348 147 z'),
};

// ── Helpers ─────────────────────────────────────────────────────────

/** Y position for a diatonic position relative to a staff's top line. */
function dpToY(dp: number, staffTopDp: number, yOffset: number): number {
  return yOffset + (staffTopDp - dp) * STEP;
}

function accidentalSymbol(acc: string): string {
  switch (acc) {
    case "#": return "\u266F";
    case "b": return "\u266D";
    case "##": return "\uD834\uDD2A";
    case "bb": return "\uD834\uDD2B";
    default: return "";
  }
}

/** Middle line of a 5-line staff (index 2). */
function middleLine(staff: StaffDef): number {
  return staff.lines[2];
}

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
      {beatPositions.map(({ x, beat }, i) =>
        beat.isRest ? null : (
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
                />
              );
            })}
          </g>
        )
      )}

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

/** Determine note duration category from fraction of whole note. */
function durationCategory(fraction: number): "whole" | "half" | "quarter" | "eighth" | "sixteenth" {
  if (fraction >= 1) return "whole";
  if (fraction >= 0.5) return "half";
  if (fraction >= 0.25) return "quarter";
  if (fraction >= 0.125) return "eighth";
  return "sixteenth";
}

function NoteHead({ note, x, staffTopDp, staffBotDp, yOffset, durationFraction, staffMiddleDp }: {
  note: NoteRender; x: number; staffTopDp: number; staffBotDp: number;
  yOffset: number; durationFraction: [number, number]; staffMiddleDp: number;
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
  // Center notehead horizontally on x
  const headX = x - headW / 2 - head.outlineXMin * s;

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
        return <line key={`ledger-${ldp}`} x1={x - LEDGER_HW} y1={ly} x2={x + LEDGER_HW} y2={ly} stroke="currentColor" strokeWidth={LINE_W} />;
      })}

      {/* Accidental */}
      {accSym && (
        <text x={x - headW / 2 - 1} y={y + (accSym === "\u266D" ? 4 : 6)} fontSize={accSym === "\u266E" ? 17 : 16} textAnchor="end"
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

// ── Note Editor ─────────────────────────────────────────────────────

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

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
// Semitone offset from C for each letter: C=0, D=2, E=4, F=5, G=7, A=9, B=11
const LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

function dpToMidi(dp: number, acc: Accidental): number {
  const letterIdx = ((dp % 7) + 7) % 7;
  const octave = Math.floor(dp / 7);
  const accOffset = acc === "#" ? 1 : acc === "b" ? -1 : 0;
  return (octave + 1) * 12 + LETTER_SEMITONES[letterIdx] + accOffset;
}

function dpToNoteName(dp: number): string {
  const letterIdx = ((dp % 7) + 7) % 7;
  const octave = Math.floor(dp / 7);
  return `${LETTERS[letterIdx]}${octave}`;
}

// Grand staff constants
const ED_TREBLE_LINES = [30, 32, 34, 36, 38];
const ED_BASS_LINES = [18, 20, 22, 24, 26];
const ED_TREBLE_TOP = 38;
const ED_TREBLE_MID = 34;
const ED_BASS_TOP = 26;
const ED_BASS_MID = 22;
const ED_BASS_BOT = 18;
const ED_GRAND_THRESHOLD = 28; // C4 — notes >= 28 go to treble
const ED_CLEF_X = 12;
const ED_TS_X = CLEF_WIDTH + 12;
const ED_LEFT = CLEF_WIDTH + TS_WIDTH + 10;
const ED_NOTE_SPACING = 55;
const ED_BARLINE_GAP = 12;

/** Fraction of a whole note for each duration. */
const DURATION_VALUE: Record<Duration, number> = {
  whole: 1,
  half: 1 / 2,
  quarter: 1 / 4,
  eighth: 1 / 8,
  sixteenth: 1 / 16,
};

/** Get the time value of a beat, accounting for dotted durations. */
function beatValue(beat: PlacedBeat): number {
  const base = DURATION_VALUE[beat.duration];
  return beat.dotted ? base * 1.5 : base;
}

/** Which durations fit in a given remaining measure space. */
function durationFits(dur: Duration, remaining: number, dotted = false): boolean {
  const val = DURATION_VALUE[dur] * (dotted ? 1.5 : 1);
  return val <= remaining + 1e-9;
}

/** Compute measure groupings: array of { startIdx, count } into the flat beats array. */
function computeMeasures(beats: PlacedBeat[], tsTop: number, tsBottom: number): { startIdx: number; count: number }[] {
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
function remainingInLastMeasure(beats: PlacedBeat[], tsTop: number, tsBottom: number): number {
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
function fillWithRests(remaining: number, posInMeasure = 0, beatUnit = 1 / 4): PlacedBeat[] {
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
function autoFillBeats(beats: PlacedBeat[], tsTop: number, tsBottom: number): PlacedBeat[] {
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
function timeKey(t: number): number {
  return Math.round(t * 10000) / 10000;
}

/** Compute cumulative time offsets for each beat. */
function beatTimeOffsets(beats: PlacedBeat[]): number[] {
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
const TREBLE_SHARP_DPS = [38, 35, 32, 36, 33, 37, 34];
/** Diatonic positions for sharps in bass clef. */
const BASS_SHARP_DPS = [24, 21, 18, 22, 19, 23, 20];
/** Diatonic positions for flats in treble clef (B E A D G C F). */
const TREBLE_FLAT_DPS = [34, 37, 33, 36, 32, 35, 31];
/** Diatonic positions for flats in bass clef. */
const BASS_FLAT_DPS = [20, 23, 19, 22, 18, 21, 24];

/** Circle-of-fifths position for each tonic index (positive = sharps, negative = flats). */
const MAJOR_KEY_SIGS: Record<number, number> = {
  0: 0, 1: 7, 2: -5, 3: 2, 4: -3, 5: 4, 6: -1, 7: 6, 8: -6, 9: 1, 10: -4, 11: 3, 12: -2, 13: 5,
};
const MINOR_KEY_SIGS: Record<number, number> = {
  0: -3, 1: 4, 2: 4, 3: -1, 4: -6, 5: 1, 6: -4, 7: 3, 8: 3, 9: -2, 10: -7, 11: 0, 12: -5, 13: 2,
};

/** Width per accidental glyph in the key signature. */
const KS_ACCIDENTAL_W = 10;

// Semitone value for each tonicIdx: C=0, C#=1, Db=1, D=2, Eb=3, E=4, F=5, F#=6, Gb=6, G=7, Ab=8, A=9, Bb=10, B=11
const TONIC_SEMITONES = [0, 1, 1, 2, 3, 4, 5, 6, 6, 7, 8, 9, 10, 11];

// All tonicIdx values for each semitone (enharmonic equivalents)
const SEMITONE_TO_TONICS: Record<number, number[]> = {
  0: [0], 1: [1, 2], 2: [3], 3: [4], 4: [5], 5: [6], 6: [7, 8], 7: [9], 8: [10], 9: [11], 10: [12], 11: [13],
};

// Semitone offset from mode tonic to its relative major tonic
const MODE_MAJOR_OFFSET: Record<string, number> = {
  dorian: 10,     // down whole step = +10
  phrygian: 8,    // down major 3rd = +8
  lydian: 7,      // down perfect 4th = +7
  mixolydian: 5,  // down perfect 5th = +5
  locrian: 1,     // down major 7th = +1
};

function getKeySig(tonicIdx: number, scaleName: string): { count: number; type: "sharp" | "flat" | "none" } {
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
const SHARP_LETTER_INDICES = [3, 0, 4, 1, 5, 2, 6]; // F, C, G, D, A, E, B
const FLAT_LETTER_INDICES = [6, 2, 5, 1, 4, 0, 3];   // B, E, A, D, G, C, F

/** Returns the accidental that the key signature applies to a given diatonic position. */
function keySignatureAccidental(dp: number, keySig: { count: number; type: "sharp" | "flat" | "none" }): Accidental {
  if (keySig.count === 0 || keySig.type === "none") return "";
  const letterIdx = ((dp % 7) + 7) % 7;
  const order = keySig.type === "sharp" ? SHARP_LETTER_INDICES : FLAT_LETTER_INDICES;
  const affected = order.slice(0, keySig.count);
  if (affected.includes(letterIdx)) return keySig.type === "sharp" ? "#" : "b";
  return "";
}

/** Resolves a stored accidental to the effective (sounding) accidental.
 *  "" means "follow the key signature", "n" means "explicitly natural". */
function effectiveAccidental(stored: Accidental, dp: number, keySig: { count: number; type: "sharp" | "flat" | "none" }): Accidental {
  if (stored === "") return keySignatureAccidental(dp, keySig);
  if (stored === "n") return "";
  return stored;
}

/** Returns the accidental symbol to display on a note (empty if implied by key signature). */
function displayAccidental(stored: Accidental, dp: number, keySig: { count: number; type: "sharp" | "flat" | "none" }): string {
  const ksAcc = keySignatureAccidental(dp, keySig);
  const eff = effectiveAccidental(stored, dp, keySig);
  if (eff === ksAcc) return "";
  // Show natural sign when overriding a key signature accidental
  if (eff === "" && ksAcc !== "") return "\u266E";
  return accidentalSymbol(eff);
}

/** Given a note's sounding accidental under the old key sig, compute what
 *  stored accidental preserves that pitch under a new key sig. */
function storedForSounding(
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

function rewriteBeatsForKeySig(
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

const TONIC_OPTIONS = [
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

const SCALE_OPTIONS = [
  { label: "Major", value: "major" },
  { label: "Minor", value: "minor" },
  { label: "Dorian", value: "dorian" },
  { label: "Phrygian", value: "phrygian" },
  { label: "Lydian", value: "lydian" },
  { label: "Mixolydian", value: "mixolydian" },
  { label: "Locrian", value: "locrian" },
];

/** Small SVG icon of a note for the duration picker buttons. */
function NoteIcon({ duration, size }: { duration: Duration; size: number }) {
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
}

/**
 * Parse a roman numeral string into its base label and figured bass figures.
 * E.g. "V65" → { base: "V", figures: ["6","5"] }
 *      "viio7" → { base: "vii°", figures: ["7"] }
 *      "I64" → { base: "I", figures: ["6","4"] }
 *      "IV" → { base: "IV", figures: [] }
 */
function parseRomanNumeral(raw: string): { base: string; figures: string[] } {
  const s = raw.trim();
  if (!s) return { base: "", figures: [] };

  // Match the roman numeral part (possibly lowercase), optional quality markers (o, °, +, ø)
  const rnMatch = s.match(/^([iIvV]+)(o|°|\+|ø)?/);
  if (!rnMatch) return { base: s, figures: [] };

  let base = rnMatch[1];
  const quality = rnMatch[2] || "";
  if (quality === "o") base += "°";
  else if (quality) base += quality;

  const rest = s.slice(rnMatch[0].length);

  // The rest should be digits representing figured bass: "7", "6", "64", "65", "43", "42"
  if (!rest || !/^\d+$/.test(rest)) {
    // If rest has non-digit content, just append it
    return { base: base + rest, figures: [] };
  }

  // Split digits into figure pairs based on common figured bass patterns
  const figures: string[] = [];
  if (rest.length === 1) {
    figures.push(rest); // "7" or "6"
  } else if (rest.length === 2) {
    figures.push(rest[0], rest[1]); // "64" → ["6","4"], "65" → ["6","5"]
  } else if (rest.length === 3) {
    figures.push(rest[0], rest[1], rest[2]); // "642" → ["6","4","2"]
  } else {
    figures.push(rest);
  }

  return { base, figures };
}

/** Check if a roman numeral string is a valid RN label. */
function isValidRomanNumeral(raw: string): boolean {
  const s = raw.trim();
  if (!s) return true; // empty is not invalid, just incomplete
  // Match: optional accidental (b, #, N), roman numeral, optional quality, optional figures
  return /^([b#]?)(N6|Ger6|Fr6|It6|[iIvV]+)(o|°|\+|ø)?(7|6|64|65|43|42)?$/.test(s);
}

/** Render formatted figured bass as React elements. */
function FormattedRn({ text, dark, invalid }: { text: string; dark: boolean; invalid?: boolean }) {
  const { base, figures } = parseRomanNumeral(text);
  if (!base && figures.length === 0) return null;

  const color = invalid ? "#dc2626" : (dark ? "#e0ddd8" : "#1a1a1a");

  if (figures.length === 0) {
    return (
      <span style={{ fontFamily: "serif", fontStyle: "italic", fontSize: 13, color }}>
        {base}
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", color }}>
      <span style={{ fontFamily: "serif", fontStyle: "italic", fontSize: 13 }}>
        {base}
      </span>
      <span style={{
        display: "inline-flex", flexDirection: "column", alignItems: "center",
        fontFamily: "serif", fontStyle: "italic", fontSize: 9, lineHeight: 1.1,
        marginLeft: 1, position: "relative", top: figures.length > 1 ? -1 : -2,
      }}>
        {figures.map((f, i) => <span key={i}>{f}</span>)}
      </span>
    </span>
  );
}

/** Roman numeral input that shows formatted figured bass when not focused. */
function RnInput({ value, onChange, dark }: { value: string; onChange: (v: string) => void; dark: boolean }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasValue = value.trim().length > 0;
  const invalid = hasValue && !isValidRomanNumeral(value);
  const borderColor = focused
    ? (dark ? "#888" : "#666")
    : invalid
      ? "#dc2626"
      : (dark ? "#555" : "#ccc");

  const containerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    border: `1px solid ${borderColor}`,
    borderRadius: 3,
    background: dark ? "#2a2a30" : "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "text",
    position: "relative",
  };

  if (focused) {
    return (
      <div style={containerStyle}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setFocused(false)}
          autoFocus
          style={{
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            border: "none",
            background: "transparent",
            color: invalid ? "#dc2626" : (dark ? "#e0ddd8" : "#1a1a1a"),
            fontSize: 13,
            fontFamily: "serif",
            fontStyle: "italic",
            textAlign: "center",
            padding: "0 2px",
            outline: "none",
          }}
        />
      </div>
    );
  }

  return (
    <div style={containerStyle} onClick={() => setFocused(true)}>
      {hasValue ? (
        <FormattedRn text={value} dark={dark} invalid={invalid} />
      ) : (
        <span style={{
          fontFamily: "serif", fontStyle: "italic", fontSize: 13,
          color: dark ? "#666" : "#aaa",
        }}>
          ?
        </span>
      )}
    </div>
  );
}

/** Collapsible legend for roman numeral entry. */
function RnLegend({ dark }: { dark: boolean }) {
  const [open, setOpen] = useState(false);
  const bg = dark ? "#2a2a30" : "#f8f7f5";
  const border = dark ? "#3a3a40" : "#e0dcd8";
  const text = dark ? "#e0ddd8" : "#1a1a1a";
  const muted = dark ? "#999" : "#666";

  const examples: [string, string][] = [
    ["I", "Root position"],
    ["I6", "1st inversion"],
    ["I64", "2nd inversion"],
    ["V7", "7th chord"],
    ["V65", "7th, 1st inv."],
    ["V43", "7th, 2nd inv."],
    ["V42", "7th, 3rd inv."],
    ["viio", "Diminished"],
    ["ii", "Minor (lowercase)"],
  ];

  return (
    <div style={{ padding: "0 16px 8px" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: muted, padding: 0,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}
      >
        <span style={{ fontSize: 10, transform: open ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>&#9654;</span>
        Roman numeral guide
      </button>
      {open && (
        <div style={{
          marginTop: 6, padding: "10px 14px", background: bg,
          border: `1px solid ${border}`, borderRadius: 6, color: text,
          display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 12,
        }}>
          {examples.map(([input, label]) => (
            <div key={input} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 130 }}>
              <span style={{
                fontFamily: "serif", fontStyle: "italic", fontWeight: 600,
                fontSize: 13, minWidth: 32,
              }}>
                <FormattedRn text={input} dark={dark} />
              </span>
              <span style={{ color: muted, fontSize: 11 }}>
                {input} &mdash; {label}
              </span>
            </div>
          ))}
          <div style={{ width: "100%", fontSize: 11, color: muted, marginTop: 4 }}>
            Use lowercase for minor (ii, iii, vi). Add &ldquo;o&rdquo; for diminished (viio). Add &ldquo;+&rdquo; for augmented.
          </div>
        </div>
      )}
    </div>
  );
}

export interface NoteEditorProps {
  header?: React.ReactNode;
  lessonConfig?: LessonConfig;
  /** Called whenever treble beats change (used by admin melody editor). */
  onTrebleBeatsChanged?: (beats: PlacedBeat[]) => void;
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
}

export function NoteEditor({ header, lessonConfig, onTrebleBeatsChanged, trebleOnly, initialTonicIdx, initialScaleName, initialTsTop, initialTsBottom, initialTrebleBeats }: NoteEditorProps) {
  const embedded = !!onTrebleBeatsChanged;
  const { token } = useAuth();
  // ── LocalStorage persistence ──────────────────────────────────────
  const STORAGE_KEY = "contrapunctus_state";

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as {
        trebleBeats?: PlacedBeat[];
        bassBeats?: PlacedBeat[];
        tsTop?: number;
        tsBottom?: number;
        tonicIdx?: number;
        scaleName?: string;
      };
    } catch { /* ignore corrupt data */ }
    return null;
  }

  const saved = useRef(lessonConfig || onTrebleBeatsChanged ? null : loadSaved());

  const [selectedDuration, setSelectedDuration] = useState<Duration>("quarter");
  const [selectedAccidental, setSelectedAccidental] = useState<Accidental>("");
  const [dottedMode, setDottedMode] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [restMode, setRestMode] = useState(false);
  const [tsTop, setTsTop] = useState(lessonConfig?.tsTop ?? initialTsTop ?? saved.current?.tsTop ?? 4);
  const [tsBottom, setTsBottom] = useState(lessonConfig?.tsBottom ?? initialTsBottom ?? saved.current?.tsBottom ?? 4);

  // Independent beat arrays for each staff
  const initRests = () => fillWithRests((lessonConfig?.tsTop ?? initialTsTop ?? 4) / (lessonConfig?.tsBottom ?? initialTsBottom ?? 4));
  const [trebleBeats, setTrebleBeatsRaw] = useState<PlacedBeat[]>(
    lessonConfig ? lessonConfig.lockedTrebleBeats : (initialTrebleBeats ?? saved.current?.trebleBeats ?? initRests)
  );
  const [bassBeats, setBassBeatsRaw] = useState<PlacedBeat[]>(saved.current?.bassBeats ?? initRests);

  // Undo/redo history: snapshots of [trebleBeats, bassBeats]
  type Snapshot = [PlacedBeat[], PlacedBeat[]];
  const historyRef = useRef<{ past: Snapshot[]; future: Snapshot[] }>({
    past: [],
    future: [],
  });

  /** Push current state onto undo stack before a mutation. */
  const pushUndo = useCallback(() => {
    setTrebleBeatsRaw((tb) => {
      setBassBeatsRaw((bb) => {
        historyRef.current.past.push([tb, bb]);
        historyRef.current.future = [];
        return bb;
      });
      return tb;
    });
  }, []);

  const setTrebleBeats: typeof setTrebleBeatsRaw = useCallback((action) => {
    pushUndo();
    setTrebleBeatsRaw((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      return autoFillBeats(next, tsTop, tsBottom);
    });
  }, [tsTop, tsBottom, pushUndo]);

  const setBassBeats: typeof setBassBeatsRaw = useCallback((action) => {
    pushUndo();
    setBassBeatsRaw((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      return autoFillBeats(next, tsTop, tsBottom);
    });
  }, [tsTop, tsBottom, pushUndo]);

  /** Get the setter for the given staff. */
  function setStaffBeats(staff: "treble" | "bass") {
    return staff === "treble" ? setTrebleBeats : setBassBeats;
  }
  function getStaffBeats(staff: "treble" | "bass") {
    return staff === "treble" ? trebleBeats : bassBeats;
  }
  function getDisplayBeats(staff: "treble" | "bass") {
    return staff === "treble" ? paddedTrebleBeats : paddedBassBeats;
  }

  const [zoom, setZoom] = useState(() => {
    try { const z = localStorage.getItem("contrapunctus_zoom"); return z ? Number(z) : 1; } catch { return 1; }
  });
  const [toolbarExpanded, setToolbarExpanded] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("contrapunctus_dark") === "true"; } catch { return false; }
  });

  const [hoverDp, setHoverDp] = useState<number | null>(null);
  const [hoverStaff, setHoverStaff] = useState<"treble" | "bass" | null>(null);
  const [hoverBeatIdx, setHoverBeatIdx] = useState<number | null>(null);
  const [tonicIdx, setTonicIdx] = useState(lessonConfig?.tonicIdx ?? initialTonicIdx ?? saved.current?.tonicIdx ?? 0);
  const [scaleName, setScaleName] = useState(lessonConfig?.scaleName ?? initialScaleName ?? saved.current?.scaleName ?? "major");
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const topBarSpacerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(880);

  // Save state to localStorage on changes (skip in lesson mode and admin embed)
  useEffect(() => {
    if (lessonConfig || onTrebleBeatsChanged) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      trebleBeats, bassBeats, tsTop, tsBottom, tonicIdx, scaleName,
    }));
  }, [trebleBeats, bassBeats, tsTop, tsBottom, tonicIdx, scaleName, lessonConfig, onTrebleBeatsChanged]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sync spacer height with fixed top bar
  useEffect(() => {
    const bar = topBarRef.current;
    const spacer = topBarSpacerRef.current;
    if (!bar || !spacer) return;
    const sync = () => { spacer.style.height = bar.offsetHeight + "px"; };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  // Key signature
  const keySig = useMemo(() => getKeySig(tonicIdx, scaleName), [tonicIdx, scaleName]);
  const ksWidth = keySig.count > 0 ? keySig.count * KS_ACCIDENTAL_W + 4 : 0;

  // Dynamic layout positions (shifted by key signature width)
  const edTsX = CLEF_WIDTH + ksWidth + 12;
  const edLeft = CLEF_WIDTH + ksWidth + TS_WIDTH + 10;

  // Layout: treble from dp 40 down to 30, gap, bass from 26 down to 16
  const displayTopDp = 42;
  const trebleYOffset = (displayTopDp - ED_TREBLE_TOP) * STEP;
  const bassYOffset = trebleYOffset + (ED_TREBLE_TOP - ED_TREBLE_LINES[0]) * STEP + STAFF_GAP;
  const displayBotDp = 14;
  const staffHeight = bassYOffset + (ED_BASS_TOP - displayBotDp) * STEP + STEP * 2;

  // Pad the shorter staff with whole-measure rests so both staves have equal measures
  const [paddedTrebleBeats, paddedBassBeats] = useMemo(() => {
    const measureCap = tsTop / tsBottom;
    const tMeasures = computeMeasures(trebleBeats, tsTop, tsBottom);
    const bMeasures = computeMeasures(bassBeats, tsTop, tsBottom);
    const maxM = Math.max(tMeasures.length, bMeasures.length);
    const padToMeasures = (beats: PlacedBeat[], mCount: number): PlacedBeat[] => {
      if (mCount >= maxM) return beats;
      const padding: PlacedBeat[] = [];
      for (let i = mCount; i < maxM; i++) {
        padding.push(...fillWithRests(measureCap));
      }
      return [...beats, ...padding];
    };
    return [
      padToMeasures(trebleBeats, tMeasures.length),
      padToMeasures(bassBeats, bMeasures.length),
    ];
  }, [trebleBeats, bassBeats, tsTop, tsBottom]);

  // Time-based beat positioning
  const trebleTimes = useMemo(() => beatTimeOffsets(paddedTrebleBeats), [paddedTrebleBeats]);
  const bassTimes = useMemo(() => beatTimeOffsets(paddedBassBeats), [paddedBassBeats]);

  const allTimePoints = useMemo(() => {
    const set = new Set<number>();
    trebleTimes.forEach((t) => set.add(t));
    bassTimes.forEach((t) => set.add(t));
    return [...set].sort((a, b) => a - b);
  }, [trebleTimes, bassTimes]);

  // Compute natural (single-line) content width — independent of container
  const contentWidth = useMemo(() => {
    const measureCap = timeKey(tsTop / tsBottom);
    const measures: { startIdx: number; endIdx: number }[] = [];
    let mStart = 0;
    for (let i = 1; i <= allTimePoints.length; i++) {
      if (i === allTimePoints.length ||
          Math.floor(allTimePoints[i] / measureCap + 1e-9) >
          Math.floor(allTimePoints[i - 1] / measureCap + 1e-9)) {
        measures.push({ startIdx: mStart, endIdx: i });
        mStart = i;
      }
    }
    let naturalX = edLeft + ED_NOTE_SPACING / 2;
    for (let m = 0; m < measures.length; m++) {
      if (m > 0) naturalX += ED_BARLINE_GAP;
      const mLen = measures[m].endIdx - measures[m].startIdx;
      naturalX += mLen * ED_NOTE_SPACING;
    }
    return naturalX + RIGHT_MARGIN;
  }, [allTimePoints, edLeft, tsTop, tsBottom]);

  // System layout: break music into rows that fit the container width
  const systemLayout = useMemo(() => {
    const staffW = containerWidth;
    const noteAreaEnd = staffW - RIGHT_MARGIN;
    const measureCap = timeKey(tsTop / tsBottom);

    // Group time point indices by measure
    const measures: { startIdx: number; endIdx: number }[] = [];
    let mStart = 0;
    for (let i = 1; i <= allTimePoints.length; i++) {
      if (i === allTimePoints.length ||
          Math.floor(allTimePoints[i] / measureCap + 1e-9) >
          Math.floor(allTimePoints[i - 1] / measureCap + 1e-9)) {
        measures.push({ startIdx: mStart, endIdx: i });
        mStart = i;
      }
    }

    // Assign measures to systems by fitting them within staffW
    const systems: { startIdx: number; endIdx: number }[] = [];
    let sysStart = 0;
    let x = edLeft + ED_NOTE_SPACING / 2;
    for (let m = 0; m < measures.length; m++) {
      const mLen = measures[m].endIdx - measures[m].startIdx;
      const mWidth = mLen * ED_NOTE_SPACING + ED_BARLINE_GAP;
      if (x + mWidth > noteAreaEnd && measures[m].startIdx > sysStart) {
        systems.push({ startIdx: sysStart, endIdx: measures[m].startIdx });
        sysStart = measures[m].startIdx;
        x = edLeft + ED_NOTE_SPACING / 2;
      }
      x += mWidth;
    }
    systems.push({ startIdx: sysStart, endIdx: allTimePoints.length });

    // Compute per-time-point positions: x and systemIdx
    const positions = new Map<number, { x: number; systemIdx: number }>();
    for (let s = 0; s < systems.length; s++) {
      let lx = edLeft + ED_NOTE_SPACING / 2;
      for (let i = systems[s].startIdx; i < systems[s].endIdx; i++) {
        if (i > systems[s].startIdx) {
          const prevM = Math.floor(allTimePoints[i - 1] / measureCap + 1e-9);
          const curM = Math.floor(allTimePoints[i] / measureCap + 1e-9);
          if (curM > prevM) lx += ED_BARLINE_GAP;
        }
        positions.set(allTimePoints[i], { x: lx, systemIdx: s });
        lx += ED_NOTE_SPACING;
      }
    }

    // Barlines per system
    const barlines: { x: number; systemIdx: number }[] = [];
    for (let k = 1; ; k++) {
      const boundary = timeKey(k * measureCap);
      let beforePos: { x: number; systemIdx: number } | null = null;
      let afterPos: { x: number; systemIdx: number } | null = null;
      for (const t of allTimePoints) {
        if (t < boundary - 1e-9) beforePos = positions.get(t)!;
        if (t >= boundary - 1e-9 && afterPos === null) afterPos = positions.get(t)!;
      }
      if (beforePos === null || afterPos === null) break;
      if (beforePos.systemIdx === afterPos.systemIdx) {
        barlines.push({ x: (beforePos.x + afterPos.x) / 2, systemIdx: beforePos.systemIdx });
      }
    }

    return { systems, positions, barlines, staffW, systemCount: Math.max(systems.length, 1) };
  }, [allTimePoints, containerWidth, edLeft, tsTop, tsBottom]);

  const { systems, barlines: barlineData, systemCount } = systemLayout;
  const staffW = systemLayout.staffW;
  const [showErrors, setShowErrors] = useState(false);
  const RN_SPACE = showErrors ? 48 : 32;
  const systemTotalHeight = staffHeight + RN_SPACE + SYSTEM_GAP_V;
  const svgHeight = systemCount * systemTotalHeight - SYSTEM_GAP_V;

  // Legacy-compatible position lookups (include system info)
  const timeToPos = systemLayout.positions;

  const trebleBeatPositions = useMemo(() =>
    trebleTimes.map((t) => {
      const p = timeToPos.get(t);
      return p ? { x: p.x, sys: p.systemIdx } : { x: edLeft, sys: 0 };
    }),
    [trebleTimes, timeToPos, edLeft]
  );
  const bassBeatPositions = useMemo(() =>
    bassTimes.map((t) => {
      const p = timeToPos.get(t);
      return p ? { x: p.x, sys: p.systemIdx } : { x: edLeft, sys: 0 };
    }),
    [bassTimes, timeToPos, edLeft]
  );

  /** Get x and system for a beat index on a staff (existing or new). */
  function staffBeatPos(staff: "treble" | "bass", idx: number): { x: number; sys: number } {
    const positions = staff === "treble" ? trebleBeatPositions : bassBeatPositions;
    if (idx < positions.length) return positions[idx];
    // New beat: past the end
    if (positions.length === 0) return { x: edLeft + ED_NOTE_SPACING / 2, sys: 0 };
    const last = positions[positions.length - 1];
    return { x: last.x + ED_NOTE_SPACING, sys: last.sys };
  }

  // Compute Roman numeral analysis by merging notes at each time point,
  // including sustained notes from longer durations on either staff.
  // NCT data: per time-point, map from midi -> label
  type NctMap = Record<number, string>;
  // Error data: per time-point, map from midi -> error labels; plus chord-level errors
  type NoteErrorMap = Record<number, string[]>;
  const analysisData = useMemo((): { romanNumerals: string[][]; chordNames: string[][]; nctMaps: NctMap[]; noteErrorMaps: NoteErrorMap[]; chordErrors: string[][] } => {
    if (trebleBeats.length === 0 && bassBeats.length === 0) return { romanNumerals: [], chordNames: [], nctMaps: [], noteErrorMaps: [], chordErrors: [] };
    const tonic = TONIC_OPTIONS[tonicIdx];
    try {
      const measureCap = timeKey(tsTop / tsBottom);

      // Helper: find which notes are sounding at time t from a staff's beats
      function soundingNotes(beats: PlacedBeat[], times: number[], t: number): PlacedNote[] {
        // Find the last beat that started at or before t
        let idx = -1;
        for (let i = 0; i < times.length; i++) {
          if (times[i] <= t + 1e-9) idx = i;
          else break;
        }
        if (idx < 0) return [];
        const beat = beats[idx];
        if (beat.isRest) return [];
        // Check if the beat's duration extends past t
        const beatEnd = times[idx] + beatValue(beat);
        if (beatEnd > t - 1e-9) return beat.notes;
        return [];
      }

      // Group time points into measures
      const measures: { time: number; notes: PlacedNote[] }[][] = [];
      let currentMeasure: { time: number; notes: PlacedNote[] }[] = [];
      for (const t of allTimePoints) {
        const measureIdx = Math.floor(t / measureCap + 1e-9);
        if (measureIdx >= measures.length + 1 && currentMeasure.length > 0) {
          measures.push(currentMeasure);
          currentMeasure = [];
        }
        // Collect all sounding notes (including sustained) from both staves
        const trebleNotes = soundingNotes(paddedTrebleBeats, trebleTimes, t);
        const bassNotes = soundingNotes(paddedBassBeats, bassTimes, t);
        // Deduplicate by dp to avoid counting the same pitch twice
        const allNotes: PlacedNote[] = [...trebleNotes];
        for (const bn of bassNotes) {
          if (!allNotes.some((n) => n.dp === bn.dp && n.accidental === bn.accidental)) {
            allNotes.push(bn);
          }
        }
        currentMeasure.push({ time: t, notes: allNotes });
      }
      if (currentMeasure.length > 0) measures.push(currentMeasure);

      const jMeasures = measures.map((m) => {
        const jBeats = m.map((tb) => {
          if (tb.notes.length === 0) return C.rest();
          const notes = tb.notes.map((n) => {
            const letterIdx = ((n.dp % 7) + 7) % 7;
            const octave = Math.floor(n.dp / 7);
            return C.note(LETTERS[letterIdx], effectiveAccidental(n.accidental, n.dp, keySig), octave);
          });
          return C.beat(notes);
        });
        return C.measure(tsTop, tsBottom, jBeats);
      });
      if (jMeasures.length === 0) return { romanNumerals: [], chordNames: [], nctMaps: [], noteErrorMaps: [], chordErrors: [] };
      const data = C.renderWithAnalysis(jMeasures, tonic.letter, tonic.acc, scaleName);
      const romanNumerals = data.measures.flatMap((m: any) => m.beats.map((b: any) => b.romanNumerals as string[]));
      const nctMaps: NctMap[] = data.measures.flatMap((m: any) =>
        m.beats.map((b: any) => {
          const map: NctMap = {};
          for (const n of b.notes) {
            if (n.nct) map[n.midi] = n.nct;
          }
          return map;
        })
      );
      const noteErrorMaps: NoteErrorMap[] = data.measures.flatMap((m: any) =>
        m.beats.map((b: any) => {
          const map: NoteErrorMap = {};
          for (const n of b.notes) {
            if (n.errors && n.errors.length > 0) map[n.midi] = [...n.errors];
          }
          return map;
        })
      );
      const chordErrors: string[][] = data.measures.flatMap((m: any) =>
        m.beats.map((b: any) => (b.chordErrors ? [...b.chordErrors] : []) as string[])
      );
      const chordNames: string[][] = data.measures.flatMap((m: any) =>
        m.beats.map((b: any) => (b.chordNames ? [...b.chordNames] : []) as string[])
      );
      return { romanNumerals, chordNames, nctMaps, noteErrorMaps, chordErrors };
    } catch (e) {
      console.error("Analysis error:", e);
      return { romanNumerals: [], chordNames: [], nctMaps: [], noteErrorMaps: [], chordErrors: [] };
    }
  }, [paddedTrebleBeats, paddedBassBeats, trebleTimes, bassTimes, allTimePoints, tonicIdx, scaleName, tsTop, tsBottom, keySig]);

  const { romanNumerals, chordNames, nctMaps, noteErrorMaps, chordErrors } = analysisData;

  // Map from time value to NCT map for that beat
  const timeToNct = useMemo(() => {
    const m = new Map<number, Record<number, string>>();
    allTimePoints.forEach((t, i) => {
      if (nctMaps[i] && Object.keys(nctMaps[i]).length > 0) m.set(t, nctMaps[i]);
    });
    return m;
  }, [allTimePoints, nctMaps]);

  // Map from time value to note error map for that beat
  const timeToNoteErrors = useMemo(() => {
    const m = new Map<number, Record<number, string[]>>();
    allTimePoints.forEach((t, i) => {
      if (noteErrorMaps[i] && Object.keys(noteErrorMaps[i]).length > 0) m.set(t, noteErrorMaps[i]);
    });
    return m;
  }, [allTimePoints, noteErrorMaps]);

  // Map from time value to chord errors for that beat
  const timeToChordErrors = useMemo(() => {
    const m = new Map<number, string[]>();
    allTimePoints.forEach((t, i) => {
      if (chordErrors[i] && chordErrors[i].length > 0) m.set(t, chordErrors[i]);
    });
    return m;
  }, [allTimePoints, chordErrors]);

  // Tooltip lookup maps for abbreviations
  const errorTooltips: Record<string, string> = {
    "\u22255": "Parallel Fifths", "\u22258": "Parallel Octaves",
    "\u2225 5": "Parallel Fifths", "\u2225 8": "Parallel Octaves",
    "\u21925": "Direct Fifths", "\u21928": "Direct Octaves",
    "\u2192 5": "Direct Fifths", "\u2192 8": "Direct Octaves",
    "VX": "Voice Crossing", "Sp": "Spacing Error",
    "2LT": "Doubled Leading Tone", "LT\u2191": "Unresolved Leading Tone",
    "7\u2193": "Unresolved Chordal 7th", "2R": "Root Not Doubled",
    "2\u00D75": "Fifth Not Doubled",
  };
  const nctTooltips: Record<string, string> = {
    "PT": "Passing Tone", "NT": "Neighbor Tone", "APP": "Appoggiatura",
    "ET": "Escape Tone", "CT": "Changing Tone", "SUS": "Suspension",
    "RET": "Retardation", "ANT": "Anticipation", "PED": "Pedal Tone",
  };
  function nctTooltip(label: string): string {
    const base = label.split(" ")[0];
    return nctTooltips[base] || label;
  }

  // Compute error summary list for the error panel
  const errorSummary = useMemo(() => {
    const items: { beat: number; measure: number; beatInMeasure: number; label: string; fullName: string; location: string }[] = [];
    const measureCap = timeKey(tsTop / tsBottom);
    allTimePoints.forEach((t, i) => {
      const measure = Math.floor(t / measureCap + 1e-9) + 1;
      const beatInMeasure = Math.round((t % measureCap) / (1 / tsBottom) + 1e-9) + 1;
      const rn = romanNumerals[i]?.[0] || "";
      const location = rn ? `Beat ${beatInMeasure}, m. ${measure} (${rn})` : `Beat ${beatInMeasure}, m. ${measure}`;
      // Note-level errors
      const noteErrs = noteErrorMaps[i];
      if (noteErrs) {
        const seen = new Set<string>();
        for (const errs of Object.values(noteErrs)) {
          for (const e of errs) {
            if (!seen.has(e)) {
              seen.add(e);
              items.push({ beat: i, measure, beatInMeasure, label: e, fullName: errorTooltips[e] || e, location });
            }
          }
        }
      }
      // Chord-level errors
      const ce = chordErrors[i];
      if (ce) {
        for (const e of ce) {
          items.push({ beat: i, measure, beatInMeasure, label: e, fullName: errorTooltips[e] || e, location });
        }
      }
    });
    return items;
  }, [allTimePoints, noteErrorMaps, chordErrors, romanNumerals, tsTop, tsBottom]);

  // Expose error summary to lesson wrapper
  useEffect(() => {
    if (lessonConfig?.onErrorsComputed) {
      lessonConfig.onErrorsComputed(errorSummary);
    }
  }, [errorSummary, lessonConfig]);

  // Expose computed roman numerals to lesson wrapper
  useEffect(() => {
    if (lessonConfig?.onRomansComputed) {
      lessonConfig.onRomansComputed(romanNumerals);
    }
  }, [romanNumerals, lessonConfig]);

  // Student RN entries (lesson mode only)
  const [studentRomans, setStudentRomans] = useState<Record<number, string>>({});
  useEffect(() => {
    if (lessonConfig?.onStudentRomansChanged) {
      lessonConfig.onStudentRomansChanged(studentRomans);
    }
  }, [studentRomans, lessonConfig]);

  // Expose beat state to lesson wrapper
  useEffect(() => {
    if (lessonConfig?.onBeatsChanged) {
      lessonConfig.onBeatsChanged(trebleBeats, bassBeats);
    }
  }, [trebleBeats, bassBeats, lessonConfig]);

  // Expose treble beats to external consumer (admin melody editor)
  useEffect(() => {
    if (onTrebleBeatsChanged) {
      onTrebleBeatsChanged(trebleBeats);
    }
  }, [trebleBeats, onTrebleBeatsChanged]);

  const [errorPanelOpen, setErrorPanelOpen] = useState(false);
  const [highlightedBeat, setHighlightedBeat] = useState<number | null>(null);

  const [rnSelections, setRnSelections] = useState<Record<number, number>>({});
  const [openRnDropdown, setOpenRnDropdown] = useState<number | null>(null);
  const [showNct, setShowNct] = useState(false);
  const [labelMode, setLabelMode] = useState<"roman" | "chord">("roman");
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [bugReportDesc, setBugReportDesc] = useState("");
  const [bugReportStatus, setBugReportStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [featureRequestOpen, setFeatureRequestOpen] = useState(false);
  const [featureRequestDesc, setFeatureRequestDesc] = useState("");
  const [featureRequestStatus, setFeatureRequestStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [legendOpen, setLegendOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [roadmapVotes, setRoadmapVotes] = useState<Record<string, number>>({});
  const [roadmapUserVotes, setRoadmapUserVotes] = useState<Set<string>>(new Set());

  // ── Playback state ──────────────────────────────────────────────────
  type InstrumentName = "piano" | "epiano" | "organ" | "strings" | "synth";
  const INSTRUMENTS: { value: InstrumentName; label: string }[] = [
    { value: "piano", label: "Piano" },
    { value: "epiano", label: "E. Piano" },
    { value: "organ", label: "Organ" },
    { value: "strings", label: "Strings" },
    { value: "synth", label: "Synth" },
  ];

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackTimeIdx, setPlaybackTimeIdx] = useState<number | null>(null);
  const [tempo, setTempo] = useState(120);
  const [playbackStartIdx, setPlaybackStartIdx] = useState(0);
  const [instrument, setInstrument] = useState<InstrumentName>("piano");
  type SynthLike = { triggerAttackRelease(notes: string | string[], duration: number | string, time?: number, velocity?: number): any; releaseAll: () => void; dispose: () => void };
  const synthRef = useRef<SynthLike | null>(null);
  const synthInstrumentRef = useRef<InstrumentName | null>(null);
  const samplerLoadedRef = useRef(false);
  const rafRef = useRef<number>(0);
  const playbackRef = useRef<{ startTimeVal: number; wholeNoteSec: number; startIdx: number } | null>(null);

  function getOrCreateSynth(): SynthLike {
    if (synthRef.current && synthInstrumentRef.current === instrument) {
      return synthRef.current;
    }
    // Dispose old synth if instrument changed
    if (synthRef.current) {
      synthRef.current.releaseAll();
      synthRef.current.dispose();
      synthRef.current = null;
    }
    samplerLoadedRef.current = false;

    let synth: SynthLike;
    switch (instrument) {
      case "piano": {
        const sampler = new Tone.Sampler({
          urls: {
            A0: "A0.mp3", C1: "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3",
            A1: "A1.mp3", C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
            A2: "A2.mp3", C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
            A3: "A3.mp3", C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
            A4: "A4.mp3", C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
            A5: "A5.mp3", C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3",
            A6: "A6.mp3", C7: "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3",
            A7: "A7.mp3", C8: "C8.mp3",
          },
          release: 1,
          baseUrl: "https://tonejs.github.io/audio/salamander/",
          onload: () => { samplerLoadedRef.current = true; },
        }).toDestination();
        synth = sampler;
        break;
      }
      case "epiano": {
        const ps = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 2,
          modulationIndex: 1.5,
          oscillator: { type: "sine" },
          envelope: { attack: 0.01, decay: 0.6, sustain: 0.2, release: 1.5 },
          modulation: { type: "triangle" },
          modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.8 },
          volume: -8,
        }).toDestination();
        ps.maxPolyphony = 32;
        samplerLoadedRef.current = true;
        synth = ps;
        break;
      }
      case "organ": {
        const ps = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sine4" },
          envelope: { attack: 0.05, decay: 0.1, sustain: 0.9, release: 0.3 },
          volume: -10,
        }).toDestination();
        ps.maxPolyphony = 32;
        samplerLoadedRef.current = true;
        synth = ps;
        break;
      }
      case "strings": {
        const ps = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sawtooth8" },
          envelope: { attack: 0.15, decay: 0.3, sustain: 0.6, release: 1.0 },
          volume: -12,
        }).toDestination();
        ps.maxPolyphony = 32;
        samplerLoadedRef.current = true;
        synth = ps;
        break;
      }
      case "synth":
      default: {
        const ps = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "triangle" },
          envelope: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.8 },
          volume: -6,
        }).toDestination();
        ps.maxPolyphony = 32;
        samplerLoadedRef.current = true;
        synth = ps;
        break;
      }
    }
    synthRef.current = synth;
    synthInstrumentRef.current = instrument;
    return synth;
  }

  function midiToNoteName(midi: number): string {
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const oct = Math.floor(midi / 12) - 1;
    return `${names[midi % 12]}${oct}`;
  }

  const handlePlay = useCallback(async () => {
    await Tone.start();
    const transport = Tone.getTransport();

    if (isPaused) {
      transport.start();
      setIsPaused(false);
      setIsPlaying(true);
      // Resume RAF tracking
      const ref = playbackRef.current;
      if (ref) {
        const tick = () => {
          if (Tone.getTransport().state !== "started") return;
          const elapsed = Tone.getTransport().seconds;
          const curTime = ref.startTimeVal + elapsed / ref.wholeNoteSec;
          let idx = ref.startIdx;
          for (let i = ref.startIdx; i < allTimePoints.length; i++) {
            if (allTimePoints[i] <= curTime + 1e-9) idx = i;
            else break;
          }
          setPlaybackTimeIdx(idx);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }
      return;
    }

    // Fresh start
    transport.cancel();
    transport.stop();
    transport.position = 0;

    const s = getOrCreateSynth();

    // Wait for sampler to finish loading (piano samples from CDN)
    if (!samplerLoadedRef.current) {
      await new Promise<void>((resolve) => {
        const check = () => {
          if (samplerLoadedRef.current) resolve();
          else setTimeout(check, 50);
        };
        check();
      });
    }
    s.releaseAll();
    const wholeNoteSec = (60 / tempo) * 4;
    const startTime = allTimePoints[playbackStartIdx] ?? 0;

    // Schedule treble notes
    for (let i = 0; i < paddedTrebleBeats.length; i++) {
      const beat = paddedTrebleBeats[i];
      if (beat.isRest || beat.notes.length === 0) continue;
      if (trebleTimes[i] < startTime - 1e-9) continue;
      const offset = (trebleTimes[i] - startTime) * wholeNoteSec;
      const dur = Math.max(0.05, beatValue(beat) * wholeNoteSec * 0.9);
      const noteNames = beat.notes.map((n) => {
        const eff = effectiveAccidental(n.accidental, n.dp, keySig);
        return midiToNoteName(dpToMidi(n.dp, eff));
      });
      transport.schedule((time) => { s.triggerAttackRelease(noteNames, dur, time); }, offset);
    }

    // Schedule bass notes
    for (let i = 0; i < paddedBassBeats.length; i++) {
      const beat = paddedBassBeats[i];
      if (beat.isRest || beat.notes.length === 0) continue;
      if (bassTimes[i] < startTime - 1e-9) continue;
      const offset = (bassTimes[i] - startTime) * wholeNoteSec;
      const dur = Math.max(0.05, beatValue(beat) * wholeNoteSec * 0.9);
      const noteNames = beat.notes.map((n) => {
        const eff = effectiveAccidental(n.accidental, n.dp, keySig);
        return midiToNoteName(dpToMidi(n.dp, eff));
      });
      transport.schedule((time) => { s.triggerAttackRelease(noteNames, dur, time); }, offset);
    }

    // Compute total duration
    let maxEnd = 0;
    for (let i = 0; i < paddedTrebleBeats.length; i++) {
      if (trebleTimes[i] < startTime - 1e-9) continue;
      const end = trebleTimes[i] + beatValue(paddedTrebleBeats[i]);
      if (end > maxEnd) maxEnd = end;
    }
    for (let i = 0; i < paddedBassBeats.length; i++) {
      if (bassTimes[i] < startTime - 1e-9) continue;
      const end = bassTimes[i] + beatValue(paddedBassBeats[i]);
      if (end > maxEnd) maxEnd = end;
    }
    const totalSec = (maxEnd - startTime) * wholeNoteSec;

    // Schedule stop — inline to avoid stale closure
    transport.schedule(() => {
      Tone.getDraw().schedule(() => {
        const tr = Tone.getTransport();
        tr.stop();
        tr.cancel();
        cancelAnimationFrame(rafRef.current);
        synthRef.current?.releaseAll();
        setIsPlaying(false);
        setIsPaused(false);
        setPlaybackTimeIdx(null);
        playbackRef.current = null;
      }, Tone.now());
    }, totalSec + 0.1);

    playbackRef.current = { startTimeVal: startTime, wholeNoteSec, startIdx: playbackStartIdx };
    transport.start();
    setIsPlaying(true);
    setIsPaused(false);
    setPlaybackTimeIdx(playbackStartIdx);

    // RAF position tracking
    const tick = () => {
      if (Tone.getTransport().state !== "started") return;
      const elapsed = Tone.getTransport().seconds;
      const curTime = startTime + elapsed / wholeNoteSec;
      let idx = playbackStartIdx;
      for (let i = playbackStartIdx; i < allTimePoints.length; i++) {
        if (allTimePoints[i] <= curTime + 1e-9) idx = i;
        else break;
      }
      setPlaybackTimeIdx(idx);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [isPaused, tempo, playbackStartIdx, allTimePoints, paddedTrebleBeats, paddedBassBeats, trebleTimes, bassTimes, keySig, instrument]);

  const handlePause = useCallback(() => {
    Tone.getTransport().pause();
    cancelAnimationFrame(rafRef.current);
    setIsPaused(true);
    setIsPlaying(false);
  }, []);

  const handleStop = useCallback(() => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    cancelAnimationFrame(rafRef.current);
    synthRef.current?.releaseAll();
    setIsPlaying(false);
    setIsPaused(false);
    setPlaybackTimeIdx(null);
    playbackRef.current = null;
  }, []);

  // Stop playback when notes change
  useEffect(() => {
    if (isPlaying || isPaused) handleStop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trebleBeats, bassBeats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      synthRef.current?.releaseAll();
      synthRef.current?.dispose();
      synthRef.current = null;
    };
  }, []);

  const submitBugReport = async () => {
    if (!token || !bugReportDesc.trim()) return;
    setBugReportStatus("sending");
    try {
      const stateJson = {
        trebleBeats,
        bassBeats,
        undoHistory: historyRef.current.past,
        redoHistory: historyRef.current.future,
        settings: {
          selectedDuration, selectedAccidental, dottedMode, deleteMode, restMode,
          tsTop, tsBottom, tonicIdx, scaleName, showNct, showErrors, rnSelections,
        },
      };
      const res = await fetch(`${API_BASE}/api/bug-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: bugReportDesc, stateJson }),
      });
      if (res.ok) {
        setBugReportStatus("sent");
        setTimeout(() => { setBugReportOpen(false); setBugReportDesc(""); setBugReportStatus("idle"); }, 1500);
      } else {
        setBugReportStatus("error");
      }
    } catch {
      setBugReportStatus("error");
    }
  };

  const submitFeatureRequest = async () => {
    if (!token || !featureRequestDesc.trim()) return;
    setFeatureRequestStatus("sending");
    try {
      const res = await fetch(`${API_BASE}/api/feature-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: featureRequestDesc }),
      });
      if (res.ok) {
        setFeatureRequestStatus("sent");
        setTimeout(() => { setFeatureRequestOpen(false); setFeatureRequestDesc(""); setFeatureRequestStatus("idle"); }, 1500);
      } else {
        setFeatureRequestStatus("error");
      }
    } catch {
      setFeatureRequestStatus("error");
    }
  };

  const fetchRoadmapVotes = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/roadmap-votes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRoadmapVotes(data.counts ?? {});
        setRoadmapUserVotes(new Set(data.userVotes ?? []));
      }
    } catch { /* ignore */ }
  };

  const toggleRoadmapVote = async (featureKey: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/roadmap-votes/${encodeURIComponent(featureKey)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRoadmapUserVotes((prev) => {
          const next = new Set(prev);
          if (data.voted) next.add(featureKey);
          else next.delete(featureKey);
          return next;
        });
        setRoadmapVotes((prev) => ({
          ...prev,
          [featureKey]: (prev[featureKey] ?? 0) + (data.voted ? 1 : -1),
        }));
      }
    } catch { /* ignore */ }
  };

  const activeLabels = labelMode === "chord" ? chordNames : romanNumerals;
  const hasRN = activeLabels.some((rn) => rn.length > 0);

  /** Convert mouse x to the nearest beat index for a given staff and system. */
  function xToBeatIdx(mouseX: number, staff: "treble" | "bass", sysIdx: number): number {
    const positions = staff === "treble" ? trebleBeatPositions : bassBeatPositions;
    const dBeats = getDisplayBeats(staff);
    if (dBeats.length === 0) return 0;
    // Allow "new beat past the end" if the last beat isn't a rest
    const rawBeats = getStaffBeats(staff);
    const hasTrailingRest = rawBeats.length > 0 && rawBeats[rawBeats.length - 1].isRest;
    let closest = 0;
    let closestDist = Infinity;
    if (!hasTrailingRest) {
      const newPos = staffBeatPos(staff, dBeats.length);
      if (newPos.sys === sysIdx) {
        closest = dBeats.length;
        closestDist = Math.abs(mouseX - newPos.x);
      }
    }
    for (let i = 0; i < positions.length; i++) {
      if (positions[i].sys !== sysIdx) continue;
      const dist = Math.abs(mouseX - positions[i].x);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    return closest;
  }

  /** Convert a pixel Y to the nearest diatonic position and which staff it's on. */
  const yToDpAndStaff = useCallback((mouseY: number): { dp: number; staff: "treble" | "bass" } => {
    const trebleBotY = dpToY(ED_TREBLE_LINES[0], ED_TREBLE_TOP, trebleYOffset);
    const bassTopY = dpToY(ED_BASS_TOP, ED_BASS_TOP, bassYOffset);
    const midGap = (trebleBotY + bassTopY) / 2;

    if (mouseY <= midGap) {
      const raw = ED_TREBLE_TOP - (mouseY - trebleYOffset) / STEP;
      return { dp: Math.round(raw), staff: "treble" };
    } else {
      const raw = ED_BASS_TOP - (mouseY - bassYOffset) / STEP;
      return { dp: Math.round(raw), staff: "bass" };
    }
  }, [trebleYOffset, bassYOffset]);

  // Drag state: tracks which note is being dragged
  const dragRef = useRef<{
    staff: "treble" | "bass";
    beatIdx: number;
    note: PlacedNote;
    startDp: number;
    startStaff: "treble" | "bass";
    moved: boolean;
  } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleY = svgHeight / rect.height;
    const scaleX = staffW / rect.width;
    const mouseY = (e.clientY - rect.top) * scaleY;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const sysIdx = Math.min(Math.floor(mouseY / systemTotalHeight), systemCount - 1);
    const localY = mouseY - sysIdx * systemTotalHeight;
    const { dp, staff } = yToDpAndStaff(localY);
    if (dp >= displayBotDp && dp <= displayTopDp) {
      setHoverDp(dp);
      setHoverStaff(staff);
      setHoverBeatIdx(xToBeatIdx(mouseX, staff, sysIdx));
      if (dragRef.current) {
        if (dp !== dragRef.current.startDp || staff !== dragRef.current.startStaff) {
          dragRef.current.moved = true;
        }
      }
    } else {
      setHoverDp(null);
      setHoverStaff(null);
      setHoverBeatIdx(null);
    }
  }, [yToDpAndStaff, trebleBeatPositions, bassBeatPositions, svgHeight, staffW, systemTotalHeight, systemCount]);

  /** In lesson mode, check if a note at the given staff/beat/dp is locked (part of the given soprano). */
  const isLockedNote = useCallback((staff: "treble" | "bass", beatIdx: number, dp: number): boolean => {
    if (!lessonConfig) return false;
    if (staff !== "treble") return false;
    const locked = lessonConfig.lockedTrebleBeats[beatIdx];
    if (!locked) return false;
    return locked.notes.some((n) => n.dp === dp);
  }, [lessonConfig]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (hoverDp === null || hoverBeatIdx === null || hoverStaff === null) return;
    if (deleteMode) return;
    const beats = getStaffBeats(hoverStaff);
    if (hoverBeatIdx < beats.length) {
      const beat = beats[hoverBeatIdx];
      const existing = beat.notes.find((n) => n.dp === hoverDp);
      if (existing) {
        // Don't allow dragging locked lesson notes
        if (isLockedNote(hoverStaff, hoverBeatIdx, hoverDp)) return;
        e.preventDefault();
        dragRef.current = {
          staff: hoverStaff,
          beatIdx: hoverBeatIdx,
          note: existing,
          startDp: hoverDp,
          startStaff: hoverStaff,
          moved: false,
        };
        return;
      }
    }
  }, [hoverDp, hoverStaff, hoverBeatIdx, trebleBeats, bassBeats, deleteMode, isLockedNote]);

  const handleMouseUp = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;

    if (drag && drag.moved && hoverDp !== null && hoverStaff !== null) {
      // Drag only within the same staff
      if (hoverStaff === drag.staff) {
        const setter = setStaffBeats(drag.staff);
        setter((prev) => {
          if (drag.beatIdx >= prev.length) return prev;
          const beat = prev[drag.beatIdx];
          const origMatch = (n: PlacedNote) => n.dp === drag.note.dp;
          const withoutOrig = beat.notes.filter((n) => !origMatch(n));
          const destMatch = (n: PlacedNote) => n.dp === hoverDp;
          const filtered = withoutOrig.filter((n) => !destMatch(n));
          const movedNote: PlacedNote = { dp: hoverDp, staff: hoverStaff, accidental: drag.note.accidental };
          const newNotes = [...filtered, movedNote];
          const updated = [...prev];
          updated[drag.beatIdx] = { ...beat, notes: newNotes };
          return updated;
        });
      }
      return;
    }

    // No drag (or didn't move) — treat as regular click
    if (hoverDp === null || hoverBeatIdx === null || hoverStaff === null) return;

    const posMatch = (n: PlacedNote) => n.dp === hoverDp;
    const hoverNote: PlacedNote = { dp: hoverDp, staff: hoverStaff, accidental: selectedAccidental };
    const setter = setStaffBeats(hoverStaff);
    const beats = getStaffBeats(hoverStaff);

    if (restMode) {
      // In lesson mode, don't allow resting over locked treble beats
      if (lessonConfig && hoverStaff === "treble") return;
      setter((prev) => {
        if (hoverBeatIdx >= prev.length) return prev;
        const beat = prev[hoverBeatIdx];
        if (beat.isRest) return prev;
        const updated = [...prev];
        updated[hoverBeatIdx] = { notes: [], duration: beat.duration, isRest: true };
        return updated;
      });
      return;
    }

    if (deleteMode) {
      // Don't delete locked notes
      if (isLockedNote(hoverStaff, hoverBeatIdx, hoverDp)) return;
      setter((prev) => {
        if (hoverBeatIdx >= prev.length) return prev;
        const beat = prev[hoverBeatIdx];
        if (beat.isRest) {
          // Remove the rest beat entirely
          const updated = prev.filter((_, i) => i !== hoverBeatIdx);
          return updated.length > 0 ? updated : fillWithRests(tsTop / tsBottom);
        }
        if (!beat.notes.some(posMatch)) return prev;
        const newNotes = beat.notes.filter((n) => !posMatch(n));
        if (newNotes.length === 0) {
          // In lesson mode, don't allow deleting all notes from a locked beat
          if (lessonConfig && hoverStaff === "treble") return prev;
          const updated = [...prev];
          updated[hoverBeatIdx] = { notes: [], duration: beat.duration, isRest: true };
          return updated;
        }
        const updated = [...prev];
        updated[hoverBeatIdx] = { ...beat, notes: newNotes };
        return updated;
      });
      return;
    }

    setter((prev) => {
      // If clicking a padded rest (beyond raw beats), expand prev to include it
      let working = prev;
      if (hoverBeatIdx >= prev.length) {
        const dBeats = hoverStaff === "treble" ? paddedTrebleBeats : paddedBassBeats;
        if (hoverBeatIdx < dBeats.length) {
          working = dBeats.slice(0, hoverBeatIdx + 1);
          // Ensure we include at least through the measure containing hoverBeatIdx
          const measureCap = tsTop / tsBottom;
          const measures = computeMeasures(dBeats, tsTop, tsBottom);
          const measure = measures.find((m) => hoverBeatIdx >= m.startIdx && hoverBeatIdx < m.startIdx + m.count);
          if (measure) {
            working = dBeats.slice(0, measure.startIdx + measure.count);
          }
        }
      }
      if (hoverBeatIdx < working.length) {
        const beat = working[hoverBeatIdx];
        if (beat.isRest) {
          const measures = computeMeasures(working, tsTop, tsBottom);
          const measure = measures.find((m) => hoverBeatIdx >= m.startIdx && hoverBeatIdx < m.startIdx + m.count);
          if (!measure) return prev;
          const restStart = hoverBeatIdx;
          const measureEnd = measure.startIdx + measure.count;
          let available = 0;
          for (let i = restStart; i < measureEnd; i++) {
            if (working[i].isRest) available += beatValue(working[i]);
            else break;
          }
          if (!durationFits(selectedDuration, available, dottedMode)) return prev;
          let restsToRemove = 0;
          let spaceFreed = 0;
          for (let i = restStart; i < measureEnd && working[i].isRest; i++) {
            restsToRemove++;
            spaceFreed += beatValue(working[i]);
          }
          const newBeat: PlacedBeat = { notes: [hoverNote], duration: selectedDuration, dotted: dottedMode || undefined };
          const leftover = spaceFreed - beatValue(newBeat);
          // Compute position in measure after the new beat for rest alignment
          let posInMeasure = 0;
          for (let i = measure.startIdx; i < restStart; i++) posInMeasure += beatValue(working[i]);
          posInMeasure += beatValue(newBeat);
          const bUnit = 1 / tsBottom;
          const fillerRests = leftover > 1e-9 ? fillWithRests(leftover, posInMeasure, bUnit) : [];
          return [
            ...working.slice(0, restStart),
            newBeat,
            ...fillerRests,
            ...working.slice(restStart + restsToRemove),
          ];
        }
        // In lesson mode on treble, don't allow duration changes
        if (lessonConfig && hoverStaff === "treble" && beat.duration !== selectedDuration) return prev;
        // Different duration selected → replace beat with new note at selected duration
        if (beat.duration !== selectedDuration) {
          // Treat like clicking on the rest space: remove this beat and consecutive rests after it,
          // then insert the new note and fill remaining space
          const measures = computeMeasures(working, tsTop, tsBottom);
          const measure = measures.find((m) => hoverBeatIdx >= m.startIdx && hoverBeatIdx < m.startIdx + m.count);
          if (!measure) return prev;
          const measureEnd = measure.startIdx + measure.count;
          // Free space from this beat onward (this beat + any consecutive rests after it)
          let beatsToRemove = 1;
          let spaceFreed = beatValue(beat);
          for (let i = hoverBeatIdx + 1; i < measureEnd && working[i].isRest; i++) {
            beatsToRemove++;
            spaceFreed += beatValue(working[i]);
          }
          if (!durationFits(selectedDuration, spaceFreed, dottedMode)) return prev;
          const newBeat: PlacedBeat = { notes: [...beat.notes], duration: selectedDuration, dotted: dottedMode || undefined };
          const leftover = spaceFreed - beatValue(newBeat);
          let posInMeasure = 0;
          for (let i = measure.startIdx; i < hoverBeatIdx; i++) posInMeasure += beatValue(working[i]);
          posInMeasure += beatValue(newBeat);
          const bUnit = 1 / tsBottom;
          const fillerRests = leftover > 1e-9 ? fillWithRests(leftover, posInMeasure, bUnit) : [];
          return [
            ...working.slice(0, hoverBeatIdx),
            newBeat,
            ...fillerRests,
            ...working.slice(hoverBeatIdx + beatsToRemove),
          ];
        }
        // Same duration — toggle/add notes within the beat
        const existing = beat.notes.find(posMatch);
        if (existing) {
          // Don't allow toggling off or changing locked soprano notes
          if (isLockedNote(hoverStaff, hoverBeatIdx, hoverDp)) return prev;
          if (existing.accidental === selectedAccidental) {
            // Toggle off this note
            const newNotes = beat.notes.filter((n) => !posMatch(n));
            if (newNotes.length === 0) {
              const updated = [...working];
              updated[hoverBeatIdx] = { notes: [], duration: beat.duration, isRest: true };
              return updated;
            }
            const updated = [...working];
            updated[hoverBeatIdx] = { ...beat, notes: newNotes };
            return updated;
          }
          // Change accidental on existing note
          const updated = [...working];
          updated[hoverBeatIdx] = { ...beat, notes: beat.notes.map((n) => posMatch(n) ? hoverNote : n) };
          return updated;
        }
        // Add note to chord
        const updated = [...working];
        updated[hoverBeatIdx] = { ...beat, notes: [...beat.notes, hoverNote] };
        return updated;
      }
      // Past the end — start a new measure
      return [...working, { notes: [hoverNote], duration: selectedDuration, dotted: dottedMode || undefined }];
    });
  }, [hoverDp, hoverStaff, hoverBeatIdx, selectedDuration, selectedAccidental, dottedMode, deleteMode, restMode, tsTop, tsBottom, trebleBeats, bassBeats, paddedTrebleBeats, paddedBassBeats, isLockedNote, lessonConfig]);

  const handleUndo = useCallback(() => {
    const { past, future } = historyRef.current;
    if (past.length === 0) return;
    // Save current state to future (redo stack)
    setTrebleBeatsRaw((tb) => {
      setBassBeatsRaw((bb) => {
        future.push([tb, bb]);
        return bb;
      });
      return tb;
    });
    const [prevTreble, prevBass] = past.pop()!;
    setTrebleBeatsRaw(prevTreble);
    setBassBeatsRaw(prevBass);
  }, []);

  const handleRedo = useCallback(() => {
    const { past, future } = historyRef.current;
    if (future.length === 0) return;
    // Save current state to past (undo stack)
    setTrebleBeatsRaw((tb) => {
      setBassBeatsRaw((bb) => {
        past.push([tb, bb]);
        return bb;
      });
      return tb;
    });
    const [nextTreble, nextBass] = future.pop()!;
    setTrebleBeatsRaw(nextTreble);
    setBassBeatsRaw(nextBass);
  }, []);

  const handleClear = useCallback(() => {
    pushUndo();
    const fresh = fillWithRests(tsTop / tsBottom);
    setTrebleBeatsRaw(fresh);
    setBassBeatsRaw(fillWithRests(tsTop / tsBottom));
  }, [tsTop, tsBottom, pushUndo]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && key === "z" && e.shiftKey) { e.preventDefault(); handleRedo(); return; }
      if (ctrl && key === "z") { e.preventDefault(); handleUndo(); return; }

      // Duration shortcuts: 1–5
      if (!ctrl && key === "1") { setSelectedDuration("whole"); return; }
      if (!ctrl && key === "2") { setSelectedDuration("half"); return; }
      if (!ctrl && key === "3") { setSelectedDuration("quarter"); return; }
      if (!ctrl && key === "4") { setSelectedDuration("eighth"); return; }
      if (!ctrl && key === "5") { setSelectedDuration("sixteenth"); return; }

      if (key === "r") { setRestMode((r) => !r); setDeleteMode(false); return; }
      if (key === "d" || key === "delete" || key === "backspace") { setDeleteMode((d) => !d); setRestMode(false); return; }
      if (key === ".") { setDottedMode((d) => !d); return; }
      if (key === " ") { e.preventDefault(); isPlaying ? handlePause() : handlePlay(); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo, handlePlay, handlePause, isPlaying]);

  /** Render a rest glyph on a single staff given its line Y positions. */
  function renderRestOnStaff(dur: Duration, x: number, lineYs: number[], opacity = 1) {
    const line3Y = lineYs[2]; // middle line
    const line4Y = lineYs[3];
    const hw = SPACE * 0.6;
    const s = GLYPH_SCALE;

    if (dur === "whole") {
      const h = STEP;
      return <rect x={x - hw} y={line4Y} width={hw * 2} height={h} fill="currentColor" opacity={opacity} />;
    }
    if (dur === "half") {
      const h = STEP;
      return <rect x={x - hw} y={line3Y - h} width={hw * 2} height={h} fill="currentColor" opacity={opacity} />;
    }
    if (dur === "quarter") {
      // Bravura quarter rest: y range -375..373, center at middle line (line 3)
      const glyph = REST_QUARTER;
      const gw = (glyph.x_max - glyph.x_min) * s;
      const gx = x - gw / 2 - glyph.x_min * s;
      return <path d={glyph.path} fill="currentColor" opacity={opacity}
        transform={`translate(${gx}, ${line3Y}) scale(${s}, ${-s})`} />;
    }
    if (dur === "eighth") {
      // Bravura eighth rest: y range -251..174, anchor so top aligns near line 4
      const glyph = REST_8TH;
      const gw = (glyph.x_max - glyph.x_min) * s;
      const gx = x - gw / 2 - glyph.x_min * s;
      // Center vertically between lines 2 and 4 (i.e. line 3)
      const anchorY = line3Y;
      return <path d={glyph.path} fill="currentColor" opacity={opacity}
        transform={`translate(${gx}, ${anchorY}) scale(${s}, ${-s})`} />;
    }
    // sixteenth
    {
      const glyph = REST_16TH;
      const gw = (glyph.x_max - glyph.x_min) * s;
      const gx = x - gw / 2 - glyph.x_min * s;
      // Anchor at line 3, glyph extends up and down from there
      const anchorY = line3Y;
      return <path d={glyph.path} fill="currentColor" opacity={opacity}
        transform={`translate(${gx}, ${anchorY}) scale(${s}, ${-s})`} />;
    }
  }



  /** Render a notehead at a position (no stem/flag — those are per-beat). */
  function renderNotehead(dp: number, dur: Duration, x: number, staffTopDp: number, staffBotDp: number, yOff: number, acc: Accidental = "", opacity = 1) {
    const y = dpToY(dp, staffTopDp, yOff);
    const s = GLYPH_SCALE;
    const head = dur === "whole" ? NOTEHEAD_WHOLE
      : dur === "half" ? NOTEHEAD_HALF
      : NOTEHEAD_BLACK;
    const headW = (head.outlineXMax - head.outlineXMin) * s;
    const headX = x - headW / 2 - head.outlineXMin * s;
    const accSym = displayAccidental(acc, dp, keySig);

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

    return (
      <g opacity={opacity}>
        {ledgers.map((ldp) => {
          const ly = dpToY(ldp, staffTopDp, yOff);
          return <line key={`l-${ldp}`} x1={x - LEDGER_HW} y1={ly} x2={x + LEDGER_HW} y2={ly} stroke="currentColor" strokeWidth={LINE_W} />;
        })}
        {accSym && (
          <text x={x - headW / 2 - 1} y={y + (accSym === "\u266D" ? 4 : 6)} fontSize={accSym === "\u266E" ? 17 : 16} textAnchor="end"
            fill="currentColor" stroke="currentColor" strokeWidth={0.5} paintOrder="stroke">{accSym}</text>
        )}
        <path d={head.path} fill="currentColor" stroke="none"
          transform={`translate(${headX}, ${y}) scale(${s}, ${-s})`} />
      </g>
    );
  }

  /** Render a complete beat (chord) with shared stem and flag. */
  function renderBeat(beat: PlacedBeat, x: number, opacity = 1, nctMap?: Record<number, string>, noteErrorMap?: Record<number, string[]>) {
    const dur = beat.duration;
    const s = GLYPH_SCALE;
    const head = dur === "whole" ? NOTEHEAD_WHOLE
      : dur === "half" ? NOTEHEAD_HALF
      : NOTEHEAD_BLACK;
    const headW = (head.outlineXMax - head.outlineXMin) * s;
    const hasStem = dur !== "whole";
    const hasFlag = dur === "eighth" || dur === "sixteenth";

    // Split notes into treble and bass by their assigned staff
    const trebleNotes = beat.notes.filter((n) => n.staff === "treble").sort((a, b) => a.dp - b.dp);
    const bassNotes = beat.notes.filter((n) => n.staff === "bass").sort((a, b) => a.dp - b.dp);

    const elements: React.ReactNode[] = [];

    // Helper: compute stem geometry for a group of notes on one staff
    function stemGeometry(
      dps: number[], staffTopDp: number, staffMidDp: number, yOff: number
    ) {
      const avgDp = dps.reduce((a, b) => a + b, 0) / dps.length;
      const stemDown = avgDp >= staffMidDp;
      const stemLeft = (head.outlineXMax - head.stemRight) * s;
      const stemX = stemDown ? x - headW / 2 + stemLeft : x - headW / 2 + head.stemRight * s;
      const topDp = Math.max(...dps);
      const botDp = Math.min(...dps);
      const topY = dpToY(topDp, staffTopDp, yOff);
      const botY = dpToY(botDp, staffTopDp, yOff);
      // Stem base: where it meets the near notehead
      const stemBaseY = stemDown ? topY : botY;
      // Stem end: extends STEM_HEIGHT beyond the far notehead
      const stemEndY = stemDown ? botY + STEM_HEIGHT : topY - STEM_HEIGHT;
      return { stemDown, stemX, stemBaseY, stemEndY };
    }

    // Render treble notes
    if (trebleNotes.length > 0) {
      const dps = trebleNotes.map((n) => n.dp);
      const { stemDown, stemX, stemBaseY, stemEndY } =
        stemGeometry(dps, ED_TREBLE_TOP, ED_TREBLE_MID, trebleYOffset);

      trebleNotes.forEach((n, i) => {
        const y = dpToY(n.dp, ED_TREBLE_TOP, trebleYOffset);
        const eff = effectiveAccidental(n.accidental, n.dp, keySig);
        const midi = dpToMidi(n.dp, eff);
        const nctLabel = nctMap?.[midi];
        const noteErrs = noteErrorMap?.[midi];
        const hasError = noteErrs && noteErrs.length > 0;
        const errText = hasError ? noteErrs!.join(", ") : "";
        const errTip = hasError ? noteErrs!.map(e => errorTooltips[e] || e).join(", ") : "";
        elements.push(
          <g key={`t-${i}`}>
            {renderNotehead(n.dp, dur, x, ED_TREBLE_TOP, ED_TREBLE_LINES[0], trebleYOffset, n.accidental, opacity)}
            {hasError && (() => {
              const badgeH = 14;
              const padX = 4;
              const tw = errText.length * 5.8 + padX * 2 + 2;
              const labelX = x + headW / 2 + 4;
              const labelY = y - 12;
              return (
                <g className="cp-fade" style={{ opacity: showErrors ? 1 : 0, pointerEvents: showErrors ? "auto" : "none" }}>
                  <title>{errTip}</title>
                  <circle cx={x} cy={y} r={headW / 2 + 3} fill="none" stroke={theme.errStroke} strokeWidth={1.5} opacity={0.85} />
                  <rect x={labelX - padX} y={labelY - badgeH + 3} width={tw} height={badgeH} rx={3} fill={theme.errBadgeBg} />
                  <text x={labelX} y={labelY} fontSize={10} fill={theme.errText} fontFamily="sans-serif" fontWeight="700">{errText}</text>
                </g>
              );
            })()}
            {nctLabel && (() => {
              const badgeH = 14;
              const padX = 4;
              const tw = nctLabel.length * 6 + padX * 2 + 2;
              const labelX = x + headW / 2 + 4;
              const labelY = y + 14;
              return (
                <g className="cp-fade" style={{ opacity: showNct ? 1 : 0, pointerEvents: showNct ? "auto" : "none" }}>
                  <title>{nctTooltip(nctLabel)}</title>
                  <rect x={labelX - padX} y={labelY - badgeH + 3} width={tw} height={badgeH} rx={3} fill={theme.nctBadgeBg} />
                  <text x={labelX} y={labelY} fontSize={10} fill={theme.nctText} fontFamily="sans-serif" fontWeight="700">{nctLabel}</text>
                </g>
              );
            })()}
          </g>
        );
      });

      if (hasStem) {
        elements.push(
          <line key="t-stem" x1={stemX} y1={stemBaseY} x2={stemX} y2={stemEndY}
            stroke="currentColor" strokeWidth={STEM_W} opacity={opacity} />
        );
        if (hasFlag) {
          const flagPath = dur === "eighth"
            ? (stemDown ? FLAG_8TH_DOWN.path : FLAG_8TH_UP.path)
            : (stemDown ? FLAG_16TH_DOWN.path : FLAG_16TH_UP.path);
          elements.push(
            <path key="t-flag" d={flagPath} fill="currentColor" stroke="none" opacity={opacity}
              transform={`translate(${stemX}, ${stemEndY}) scale(${s}, ${-s})`} />
          );
        }
      }
    }

    // Render bass notes
    if (bassNotes.length > 0) {
      const dps = bassNotes.map((n) => n.dp);
      const { stemDown, stemX, stemBaseY, stemEndY } =
        stemGeometry(dps, ED_BASS_TOP, ED_BASS_MID, bassYOffset);

      bassNotes.forEach((n, i) => {
        const y = dpToY(n.dp, ED_BASS_TOP, bassYOffset);
        const eff = effectiveAccidental(n.accidental, n.dp, keySig);
        const midi = dpToMidi(n.dp, eff);
        const nctLabel = nctMap?.[midi];
        const noteErrs = noteErrorMap?.[midi];
        const hasError = noteErrs && noteErrs.length > 0;
        const errText = hasError ? noteErrs!.join(", ") : "";
        const errTip = hasError ? noteErrs!.map(e => errorTooltips[e] || e).join(", ") : "";
        elements.push(
          <g key={`b-${i}`}>
            {renderNotehead(n.dp, dur, x, ED_BASS_TOP, ED_BASS_LINES[0], bassYOffset, n.accidental, opacity)}
            {hasError && (() => {
              const badgeH = 14;
              const padX = 4;
              const tw = errText.length * 5.8 + padX * 2 + 2;
              const labelX = x + headW / 2 + 4;
              const labelY = y - 12;
              return (
                <g className="cp-fade" style={{ opacity: showErrors ? 1 : 0, pointerEvents: showErrors ? "auto" : "none" }}>
                  <title>{errTip}</title>
                  <circle cx={x} cy={y} r={headW / 2 + 3} fill="none" stroke={theme.errStroke} strokeWidth={1.5} opacity={0.85} />
                  <rect x={labelX - padX} y={labelY - badgeH + 3} width={tw} height={badgeH} rx={3} fill={theme.errBadgeBg} />
                  <text x={labelX} y={labelY} fontSize={10} fill={theme.errText} fontFamily="sans-serif" fontWeight="700">{errText}</text>
                </g>
              );
            })()}
            {nctLabel && (() => {
              const badgeH = 14;
              const padX = 4;
              const tw = nctLabel.length * 6 + padX * 2 + 2;
              const labelX = x + headW / 2 + 4;
              const labelY = y + 14;
              return (
                <g className="cp-fade" style={{ opacity: showNct ? 1 : 0, pointerEvents: showNct ? "auto" : "none" }}>
                  <title>{nctTooltip(nctLabel)}</title>
                  <rect x={labelX - padX} y={labelY - badgeH + 3} width={tw} height={badgeH} rx={3} fill={theme.nctBadgeBg} />
                  <text x={labelX} y={labelY} fontSize={10} fill={theme.nctText} fontFamily="sans-serif" fontWeight="700">{nctLabel}</text>
                </g>
              );
            })()}
          </g>
        );
      });

      if (hasStem) {
        elements.push(
          <line key="b-stem" x1={stemX} y1={stemBaseY} x2={stemX} y2={stemEndY}
            stroke="currentColor" strokeWidth={STEM_W} opacity={opacity} />
        );
        if (hasFlag) {
          const flagPath = dur === "eighth"
            ? (stemDown ? FLAG_8TH_DOWN.path : FLAG_8TH_UP.path)
            : (stemDown ? FLAG_16TH_DOWN.path : FLAG_16TH_UP.path);
          elements.push(
            <path key="b-flag" d={flagPath} fill="currentColor" stroke="none" opacity={opacity}
              transform={`translate(${stemX}, ${stemEndY}) scale(${s}, ${-s})`} />
          );
        }
      }
    }

    // Augmentation dot for dotted notes
    if (beat.dotted) {
      const allDps = [...trebleNotes, ...bassNotes].map((n) => n.dp);
      const dotX = x + headW / 2 + 4;
      for (const ndp of allDps) {
        // If note is on a line, shift dot up to the space above
        const dotDp = ndp % 2 === 0 ? ndp + 1 : ndp;
        const staff = ndp >= ED_GRAND_THRESHOLD ? "treble" : "bass";
        const sTop = staff === "treble" ? ED_TREBLE_TOP : ED_BASS_TOP;
        const yO = staff === "treble" ? trebleYOffset : bassYOffset;
        const dotY = dpToY(dotDp, sTop, yO);
        elements.push(
          <circle key={`dot-${ndp}`} cx={dotX} cy={dotY} r={1.5} fill="currentColor" opacity={opacity} />
        );
      }
    }

    return <g>{elements}</g>;
  }

  const dk = darkMode;
  const theme = {
    toolbarBg: dk ? "#26262b" : "#f5f3f0",
    toolbarBorder: dk ? "#3a3a40" : "#e0dcd8",
    groupBg: dk ? "#32323a" : "#eceae6",
    pageBg: dk ? "#2a2a30" : "#faf8f4",
    pageManuscript: dk ? "#2e2e34" : "#ede8e0",
    pageBorder: dk ? "#3a3a40" : "#d8d4ce",
    footerBg: dk ? "#26262b" : "#f5f3f0",
    footerBorder: dk ? "#3a3a40" : "#e0dcd8",
    text: dk ? "#e0ddd8" : "#2c2c2c",
    textMuted: dk ? "#999" : "#5a5a5a",
    selectBg: dk ? "#32323a" : "#faf9f7",
    selectBorder: dk ? "#555" : "#d0ccc8",
    row2Border: dk ? "#3a3a40" : "#e8e5e1",
    errText: dk ? "#fca5a5" : "#fff",
    errBadgeBg: dk ? "rgba(220,38,38,0.85)" : "rgba(185,28,28,0.82)",
    errStroke: dk ? "#fb7185" : "#e74c3c",
    nctText: dk ? "#86efac" : "#fff",
    nctBadgeBg: dk ? "rgba(22,163,74,0.82)" : "rgba(21,128,61,0.82)",
  };

  const durations: Duration[] = ["whole", "half", "quarter", "eighth", "sixteenth"];
  const durationShortcuts: Record<Duration, string> = { whole: "1", half: "2", quarter: "3", eighth: "4", sixteenth: "5" };

  const btnBase: React.CSSProperties = {
    width: 34, height: 34,
    borderRadius: 6,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    border: "1px solid transparent",
    background: "transparent",
    color: theme.textMuted,
    transition: "all 0.15s ease",
  };
  const btnOn = (on: boolean): React.CSSProperties => ({
    ...btnBase,
    ...(on ? {
      border: "1px solid #8b7e6e",
      background: "#e8e4df",
      color: "#2c2c2c",
      boxShadow: "inset 0 1px 3px rgba(0,0,0,0.12)",
    } : {}),
  });

  const selectStyle: React.CSSProperties = {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 13,
    padding: "4px 8px",
    borderRadius: 5,
    border: `1px solid ${theme.selectBorder}`,
    background: theme.selectBg,
    color: theme.text,
    cursor: "pointer",
  };

  const textBtnStyle = (active: boolean, danger = false): React.CSSProperties => ({
    ...btnBase,
    width: "auto",
    padding: "0 10px",
    fontSize: 12,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontWeight: 500,
    letterSpacing: 0.3,
    ...(danger && active ? {
      border: "1px solid #c33",
      background: "#c33",
      color: "#fff",
    } : active ? {
      border: "1px solid #5a5347",
      background: "#5a5347",
      color: "#fff",
      boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)",
    } : {}),
  });
  const textBtnClass = (active: boolean, danger = false): string =>
    active ? (danger ? "cp-active-danger" : "cp-active") : "";

  /** Pill-shaped group with subtle background. */
  const groupStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 3,
    background: theme.groupBg,
    borderRadius: 8,
    padding: "3px 4px",
  };

  /** Muted label preceding a group. */
  const groupLabel: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 500,
    color: "#a09a94",
    textTransform: "uppercase",
    letterSpacing: 1,
    padding: "0 5px 0 2px",
    whiteSpace: "nowrap",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  // Dark mode: apply to body
  useEffect(() => {
    if (darkMode) {
      document.body.style.background = "#1a1a1e";
      document.body.style.color = "#e0ddd8";
    } else {
      document.body.style.background = "#e8e4e0";
      document.body.style.color = "#2c2c2c";
    }
  }, [darkMode]);

  return (
    <div>
      {/* Toolbar hover styles */}
      <style>{`
        .cp-toolbar button:hover:not([disabled]):not(.cp-active):not(.cp-active-danger) { opacity: 0.8; }
        .cp-toolbar button.cp-active:hover:not([disabled]) { background: #6e685c !important; color: #fff !important; }
        .cp-toolbar button.cp-active-danger:hover:not([disabled]) { background: #d94444 !important; color: #fff !important; }
        .cp-toolbar button:active:not([disabled]) { transform: scale(0.96); }
        .cp-fade { transition: opacity 0.25s ease; }
      `}</style>
      {/* Fixed top bar */}
      <div ref={topBarRef} className="cp-toolbar" style={{
        position: embedded ? "sticky" : "fixed",
        top: 0,
        left: embedded ? undefined : 0,
        right: embedded ? undefined : 0,
        zIndex: 100,
        background: theme.toolbarBg,
        borderBottom: `1px solid ${theme.toolbarBorder}`,
        padding: "0 16px",
        color: theme.text,
      }}>
        {/* Title bar — hidden in embedded mode */}
        {!embedded && <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "6px 0 4px",
          borderBottom: `1px solid ${dk ? "#3a3a40" : "#e0dcd8"}`,
        }}>
          <span style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: -0.5,
            color: theme.text,
          }}>
            Contrapunctus
          </span>
        </div>}
        {/* Collapsed: single compact row */}
        {!toolbarExpanded && (
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 0",
          gap: 8,
        }}>
          {/* Note values — compact */}
          <div style={groupStyle}>
            {durations.map((key) => (
              <button key={key} onClick={() => setSelectedDuration(key)}
                style={btnOn(selectedDuration === key)} title={`${key} (${durationShortcuts[key]})`}>
                <NoteIcon duration={key} size={24} />
              </button>
            ))}
            <button onClick={() => setDottedMode((d) => !d)}
              style={{ ...btnOn(dottedMode), fontSize: 20, fontWeight: 700 }}
              title="Dotted note (.)">
              .
            </button>
          </div>

          {/* Accidentals */}
          <div style={groupStyle}>
            {([["n", "\u266E"], ["#", "\u266F"], ["b", "\u266D"]] as [Accidental, string][]).map(([acc, sym]) => (
              <button key={acc} onClick={() => setSelectedAccidental((prev) => prev === acc ? "" : acc)}
                style={{ ...btnOn(selectedAccidental === acc), fontSize: 18 }}
                title={acc === "#" ? "Sharp" : acc === "b" ? "Flat" : "Natural"}>
                {sym}
              </button>
            ))}
          </div>

          {/* Minimal edit */}
          <div style={groupStyle}>
            <button
              onClick={() => { setRestMode((r) => !r); setDeleteMode(false); }}
              style={textBtnStyle(restMode)}
              className={textBtnClass(restMode)}
              title="Rest mode (R)"
            >
              Rest
            </button>
            <button
              onClick={() => { setDeleteMode((d) => !d); setRestMode(false); }}
              style={textBtnStyle(deleteMode, true)}
              className={textBtnClass(deleteMode, true)}
              title="Delete mode (D)"
            >
              Del
            </button>
          </div>

          {/* Playback */}
          <div style={groupStyle}>
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              style={textBtnStyle(isPlaying)}
              className={textBtnClass(isPlaying)}
              title={isPlaying ? "Pause (Space)" : isPaused ? "Resume (Space)" : "Play (Space)"}
            >
              {isPlaying ? "\u23F8" : "\u25B6"}
            </button>
            <button
              onClick={handleStop}
              style={{ ...textBtnStyle(false), opacity: (!isPlaying && !isPaused) ? 0.4 : 1 }}
              title="Stop"
              disabled={!isPlaying && !isPaused}
            >
              {"\u23F9"}
            </button>
          </div>

          {/* Note indicator + expand toggle — pushed right */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: theme.textMuted, fontSize: 18, fontFamily: "serif", minWidth: 40, textAlign: "right" }}>
              {hoverDp !== null ? (() => {
                const letterIdx = ((hoverDp % 7) + 7) % 7;
                const octave = Math.floor(hoverDp / 7);
                const acc = accidentalSymbol(effectiveAccidental(selectedAccidental, hoverDp, keySig));
                return `${LETTERS[letterIdx]}${acc}${octave}`;
              })() : "\u00A0"}
            </span>
            <button
              onClick={() => setToolbarExpanded(true)}
              style={{ ...btnBase, width: 28, height: 28, color: "#888" }}
              title="Expand toolbar"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 5.5 L7 9.5 L11 5.5" />
              </svg>
            </button>
          </div>
        </div>
        )}

        {/* Expanded: full two-row toolbar */}
        {toolbarExpanded && (<>
        {/* Row 1: Note entry */}
        <div style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "6px 0",
          gap: 8,
        }}>
          {/* Note values */}
          <div style={groupStyle}>
            <span style={groupLabel}>Note</span>
            {durations.map((key) => (
              <button key={key} onClick={() => setSelectedDuration(key)}
                style={btnOn(selectedDuration === key)} title={`${key} (${durationShortcuts[key]})`}>
                <NoteIcon duration={key} size={24} />
              </button>
            ))}
            <button onClick={() => setDottedMode((d) => !d)}
              style={{ ...btnOn(dottedMode), fontSize: 20, fontWeight: 700 }}
              title="Dotted note (.)">
              .
            </button>
          </div>

          {/* Accidentals */}
          <div style={groupStyle}>
            <span style={groupLabel}>Acc</span>
            {([["n", "\u266E"], ["#", "\u266F"], ["b", "\u266D"]] as [Accidental, string][]).map(([acc, sym]) => (
              <button key={acc} onClick={() => setSelectedAccidental((prev) => prev === acc ? "" : acc)}
                style={{ ...btnOn(selectedAccidental === acc), fontSize: 18 }}
                title={acc === "#" ? "Sharp" : acc === "b" ? "Flat" : "Natural"}>
                {sym}
              </button>
            ))}
          </div>

          {/* Edit actions */}
          <div style={groupStyle}>
            <span style={groupLabel}>Edit</span>
            <button
              onClick={() => { setRestMode((r) => !r); setDeleteMode(false); }}
              style={textBtnStyle(restMode)}
              className={textBtnClass(restMode)}
              title="Rest mode — click a note/chord to replace it with a rest (R)"
            >
              Rest
            </button>
            <button
              onClick={() => { setDeleteMode((d) => !d); setRestMode(false); }}
              style={textBtnStyle(deleteMode, true)}
              className={textBtnClass(deleteMode, true)}
              title="Toggle delete mode — click notes to remove them (D)"
            >
              Delete
            </button>
            <button onClick={handleUndo} style={textBtnStyle(false)} title="Undo (Ctrl+Z)">Undo</button>
            <button onClick={handleRedo} style={textBtnStyle(false)} title="Redo (Ctrl+Shift+Z)">Redo</button>
            {!lessonConfig && <button onClick={handleClear} style={textBtnStyle(false)} title="Clear all">Clear</button>}
          </div>

          {/* Analysis toggles — hidden in lesson mode */}
          {!lessonConfig && (<div style={groupStyle}>
            <span style={groupLabel}>Analysis</span>
            <button
              onClick={() => setLabelMode((m) => m === "roman" ? "chord" : "roman")}
              style={textBtnStyle(labelMode === "chord")}
              className={textBtnClass(labelMode === "chord")}
              title="Toggle between roman numerals and chord names"
            >
              {labelMode === "chord" ? "Chords" : "RN"}
            </button>
            <button
              onClick={() => setShowNct((v) => !v)}
              style={textBtnStyle(showNct)}
              className={textBtnClass(showNct)}
              title="Show non-chord tone labels"
            >
              NCT
            </button>
            <button
              onClick={() => setShowErrors((v) => { if (!v) setErrorPanelOpen(true); return !v; })}
              style={textBtnStyle(showErrors)}
              className={textBtnClass(showErrors)}
              title="Show part-writing errors"
            >
              Errors
            </button>
            {showErrors && (() => {
              const count = errorSummary.length;
              const hasIssues = count > 0;
              const issueColor = hasIssues
                ? (dk ? "#fbbf24" : "#d97706")
                : (dk ? "#4ade80" : "#16a34a");
              return hasIssues ? (
                <button
                  onClick={() => { setErrorPanelOpen((v) => !v); setHighlightedBeat(null); }}
                  style={{ ...textBtnStyle(errorPanelOpen), color: errorPanelOpen ? "#fff" : issueColor, fontSize: 11 }}
                  className={textBtnClass(errorPanelOpen)}
                  title="Toggle error summary panel"
                >
                  {count} issue{count !== 1 ? "s" : ""}
                </button>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 600, color: issueColor, padding: "0 6px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
                  No issues
                </span>
              );
            })()}
            <button
              onClick={() => setLegendOpen(true)}
              style={textBtnStyle(false)}
              title="Show legend for abbreviations"
            >
              Legend
            </button>
          </div>)}

          {/* Meta actions */}
          <div style={groupStyle}>
            <button
              onClick={() => { setBugReportOpen(true); setBugReportStatus("idle"); }}
              style={textBtnStyle(false)}
              title="Report a bug"
            >
              Bug
            </button>
            <button
              onClick={() => { setFeatureRequestOpen(true); setFeatureRequestStatus("idle"); }}
              style={textBtnStyle(false)}
              title="Request a feature"
            >
              Request
            </button>
            <button
              onClick={() => { setRoadmapOpen(true); fetchRoadmapVotes(); }}
              style={textBtnStyle(false)}
              title="View roadmap"
            >
              Roadmap
            </button>
          </div>

          {/* Note indicator — pushed right */}
          <span style={{ marginLeft: "auto", color: theme.textMuted, fontSize: 18, fontFamily: "serif", minWidth: 40, textAlign: "right" }}>
            {hoverDp !== null ? (() => {
              const letterIdx = ((hoverDp % 7) + 7) % 7;
              const octave = Math.floor(hoverDp / 7);
              const acc = accidentalSymbol(effectiveAccidental(selectedAccidental, hoverDp, keySig));
              return `${LETTERS[letterIdx]}${acc}${octave}`;
            })() : "\u00A0"}
          </span>
        </div>

        {/* Row 2: Playback & settings */}
        <div style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "4px 0 6px",
          gap: 8,
          borderTop: `1px solid ${theme.row2Border}`,
        }}>
          {/* Playback */}
          <div style={groupStyle}>
            <span style={groupLabel}>Play</span>
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              style={textBtnStyle(isPlaying)}
              className={textBtnClass(isPlaying)}
              title={isPlaying ? "Pause (Space)" : isPaused ? "Resume (Space)" : "Play (Space)"}
            >
              {isPlaying ? "\u23F8" : "\u25B6"}
            </button>
            <button
              onClick={handleStop}
              style={{ ...textBtnStyle(false), opacity: (!isPlaying && !isPaused) ? 0.4 : 1 }}
              title="Stop"
              disabled={!isPlaying && !isPaused}
            >
              {"\u23F9"}
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 13, color: "#5a5a5a" }}>
              <span style={{ fontSize: 14 }}>{"\u2669"}</span>
              <span>=</span>
              <input
                type="number"
                min={40}
                max={240}
                value={tempo}
                onChange={(e) => setTempo(Math.max(40, Math.min(240, Number(e.target.value))))}
                style={{
                  width: 52,
                  fontSize: 13,
                  fontFamily: "inherit",
                  border: "1px solid #d0ccc8",
                  borderRadius: 4,
                  padding: "4px 6px",
                  textAlign: "center",
                  background: "#faf9f7",
                }}
              />
            </label>
            <select
              value={instrument}
              onChange={(e) => setInstrument(e.target.value as InstrumentName)}
              style={selectStyle}
              title="Instrument"
            >
              {INSTRUMENTS.map((inst) => (
                <option key={inst.value} value={inst.value}>{inst.label}</option>
              ))}
            </select>
          </div>

          {/* Time signature */}
          <div style={groupStyle}>
            <span style={groupLabel}>Time</span>
            <select value={tsTop} onChange={(e) => setTsTop(Number(e.target.value))} style={selectStyle} disabled={!!lessonConfig}>
              {[2, 3, 4, 5, 6, 7, 8, 9, 12].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span style={{ color: "#999", fontSize: 13 }}>/</span>
            <select value={tsBottom} onChange={(e) => setTsBottom(Number(e.target.value))} style={selectStyle} disabled={!!lessonConfig}>
              {[2, 4, 8, 16].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Key */}
          <div style={groupStyle}>
            <span style={groupLabel}>Key</span>
            <select value={tonicIdx} onChange={(e) => {
              const newIdx = Number(e.target.value);
              const oldKS = keySig;
              const newKS = getKeySig(newIdx, scaleName);
              setTrebleBeatsRaw((tb) => rewriteBeatsForKeySig(tb, oldKS, newKS));
              setBassBeatsRaw((bb) => rewriteBeatsForKeySig(bb, oldKS, newKS));
              setTonicIdx(newIdx);
            }} style={selectStyle} disabled={!!lessonConfig}>
              {TONIC_OPTIONS.map((t, i) => (
                <option key={t.label} value={i}>{t.label}</option>
              ))}
            </select>
            <select value={scaleName} onChange={(e) => {
              const newScale = e.target.value;
              const oldKS = keySig;
              const newKS = getKeySig(tonicIdx, newScale);
              setTrebleBeatsRaw((tb) => rewriteBeatsForKeySig(tb, oldKS, newKS));
              setBassBeatsRaw((bb) => rewriteBeatsForKeySig(bb, oldKS, newKS));
              setScaleName(newScale);
            }} style={selectStyle} disabled={!!lessonConfig}>
              {SCALE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Zoom */}
          <div style={groupStyle}>
            <span style={groupLabel}>Zoom</span>
            <button onClick={() => { const z = Math.max(0.5, +(zoom - 0.1).toFixed(1)); setZoom(z); localStorage.setItem("contrapunctus_zoom", String(z)); }}
              style={{ ...btnBase, width: 28, height: 28 }} title="Zoom out">−</button>
            <span style={{ fontSize: 12, color: theme.textMuted, minWidth: 32, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => { const z = Math.min(2, +(zoom + 0.1).toFixed(1)); setZoom(z); localStorage.setItem("contrapunctus_zoom", String(z)); }}
              style={{ ...btnBase, width: 28, height: 28 }} title="Zoom in">+</button>
          </div>

          {/* Dark mode */}
          <div style={groupStyle}>
            <button
              onClick={() => { const v = !darkMode; setDarkMode(v); localStorage.setItem("contrapunctus_dark", String(v)); }}
              style={{ ...btnBase, width: 28, height: 28 }}
              className={textBtnClass(darkMode)}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? "☀" : "☾"}
            </button>
          </div>

          {/* Collapse toggle — pushed right */}
          <button
            onClick={() => setToolbarExpanded(false)}
            style={{ ...btnBase, width: 28, height: 28, color: "#888", marginLeft: "auto" }}
            title="Collapse toolbar"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5 L7 5.5 L11 9.5" />
            </svg>
          </button>
        </div>
        </>)}

      {/* Bug report modal */}
      {bugReportOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000,
        }} onClick={() => { if (bugReportStatus !== "sending") { setBugReportOpen(false); setBugReportStatus("idle"); } }}>
          <div style={{
            background: "#fff", borderRadius: 8, padding: 24, width: 400,
            maxWidth: "90vw", boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontFamily: "inherit" }}>Report a Bug</h3>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>
              Your current editor state and undo history will be included automatically.
            </p>
            <textarea
              value={bugReportDesc}
              onChange={(e) => setBugReportDesc(e.target.value)}
              placeholder="Describe what went wrong..."
              rows={4}
              style={{
                width: "100%", boxSizing: "border-box", padding: 8, fontSize: 13,
                fontFamily: "inherit", border: "1px solid #ccc", borderRadius: 4,
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setBugReportOpen(false); setBugReportStatus("idle"); }}
                disabled={bugReportStatus === "sending"}
                style={{ padding: "6px 16px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", border: "1px solid #ccc", borderRadius: 4, background: "none" }}
              >
                Cancel
              </button>
              <button
                onClick={submitBugReport}
                disabled={bugReportStatus === "sending" || !bugReportDesc.trim()}
                style={{
                  padding: "6px 16px", fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                  border: "1px solid #333", borderRadius: 4,
                  background: bugReportStatus === "sent" ? "#27ae60" : bugReportStatus === "error" ? "#c0392b" : "#333",
                  color: "#fff",
                }}
              >
                {bugReportStatus === "sending" ? "Sending..." : bugReportStatus === "sent" ? "Sent!" : bugReportStatus === "error" ? "Failed - Retry" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Feature request modal */}
      {featureRequestOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000,
        }} onClick={() => { if (featureRequestStatus !== "sending") { setFeatureRequestOpen(false); setFeatureRequestStatus("idle"); } }}>
          <div style={{
            background: "#fff", borderRadius: 8, padding: 24, width: 400,
            maxWidth: "90vw", boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontFamily: "inherit" }}>Request a Feature</h3>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>
              Describe the feature you'd like to see in Contrapunctus.
            </p>
            <textarea
              value={featureRequestDesc}
              onChange={(e) => setFeatureRequestDesc(e.target.value)}
              placeholder="Describe the feature..."
              rows={4}
              style={{
                width: "100%", boxSizing: "border-box", padding: 8, fontSize: 13,
                fontFamily: "inherit", border: "1px solid #ccc", borderRadius: 4,
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setFeatureRequestOpen(false); setFeatureRequestStatus("idle"); }}
                disabled={featureRequestStatus === "sending"}
                style={{ padding: "6px 16px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", border: "1px solid #ccc", borderRadius: 4, background: "none" }}
              >
                Cancel
              </button>
              <button
                onClick={submitFeatureRequest}
                disabled={featureRequestStatus === "sending" || !featureRequestDesc.trim()}
                style={{
                  padding: "6px 16px", fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                  border: "1px solid #333", borderRadius: 4,
                  background: featureRequestStatus === "sent" ? "#27ae60" : featureRequestStatus === "error" ? "#c0392b" : "#333",
                  color: "#fff",
                }}
              >
                {featureRequestStatus === "sending" ? "Sending..." : featureRequestStatus === "sent" ? "Sent!" : featureRequestStatus === "error" ? "Failed - Retry" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roadmap modal */}
      {roadmapOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000,
        }} onClick={() => setRoadmapOpen(false)}>
          <div style={{
            background: "#fff", borderRadius: 8, padding: 28, width: 680,
            maxWidth: "90vw", maxHeight: "80vh", overflow: "auto",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontFamily: "inherit" }}>Roadmap</h3>
            {[
              {
                key: "lessons",
                title: "Interactive Lessons",
                desc: "Guided exercises in harmony and part writing. Analyze chords yourself instead of auto-detection, find part-writing errors in a given score, harmonize a melody or bass line without breaking voice-leading rules, and more.",
              },
              {
                key: "new-project",
                title: "New Project & Auto Save",
                desc: "Create, name, and manage multiple projects. Work is automatically saved to the cloud as you compose, with full version history so you never lose progress.",
              },
              {
                key: "export-midi",
                title: "MIDI Export",
                desc: "Export your composition as a standard MIDI file for playback in any DAW, notation software, or synthesizer. Supports multi-voice export preserving your exact voicings.",
              },
              {
                key: "counterpoint-analysis",
                title: "Counterpoint Analysis",
                desc: "Species counterpoint validation and analysis. Check adherence to first through fifth species rules, identify dissonance treatment patterns, and get feedback on melodic contour and intervallic motion.",
              },
              {
                key: "chord-dictionary",
                title: "Chord Dictionary & Suggestions",
                desc: "Browse a comprehensive dictionary of chord types with audio playback. Get context-aware chord suggestions based on the current key, preceding harmony, and common progressions to help guide composition.",
              },
              {
                key: "mode-transforms",
                title: "Mode Transforms",
                desc: "Transform your composition between parallel and relative modes — switch from major to minor, Dorian, Mixolydian, and other modes while intelligently adapting chord qualities and melodic intervals.",
              },
              {
                key: "ai-assistant",
                title: "AI Assistant",
                desc: "An integrated AI assistant that can analyze your harmonic choices, suggest continuations, explain theoretical concepts in context, and help you explore compositional possibilities.",
              },
            ].map((item) => (
              <div key={item.key} style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
                <button
                  onClick={() => toggleRoadmapVote(item.key)}
                  disabled={!token}
                  title={!token ? "Sign in to vote" : roadmapUserVotes.has(item.key) ? "Remove vote" : "Vote for this feature"}
                  style={{
                    flexShrink: 0, width: 48, padding: "4px 0", fontSize: 13, fontFamily: "inherit",
                    cursor: token ? "pointer" : "default", border: "1px solid #ccc", borderRadius: 4,
                    background: roadmapUserVotes.has(item.key) ? "#333" : "#fff",
                    color: roadmapUserVotes.has(item.key) ? "#fff" : "#333",
                    display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.2,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{roadmapUserVotes.has(item.key) ? "\u2764\uFE0F" : "\u2661"}</span>
                  <span>{roadmapVotes[item.key] ?? 0}</span>
                </button>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{item.title}</h4>
                  <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button
                onClick={() => setRoadmapOpen(false)}
                style={{ padding: "6px 16px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", border: "1px solid #ccc", borderRadius: 4, background: "none" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legend modal */}
      {legendOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000,
        }} onClick={() => setLegendOpen(false)}>
          <div style={{
            background: "#fff", borderRadius: 8, padding: 28, width: 800,
            maxWidth: "90vw", maxHeight: "80vh", overflow: "auto",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontFamily: "inherit" }}>Legend</h3>

            <h4 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>Part-Writing Errors</h4>
            <table style={{ width: "100%", fontSize: 13, lineHeight: 1.6, marginBottom: 20, borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["\u2225 5", "Parallel Fifths", "Two voices move in parallel motion maintaining a perfect fifth."],
                  ["\u2225 8", "Parallel Octaves", "Two voices move in parallel motion maintaining a perfect octave/unison."],
                  ["\u2192 5", "Direct Fifths", "Soprano and bass move in similar motion by leap to a perfect fifth."],
                  ["\u2192 8", "Direct Octaves", "Soprano and bass move in similar motion by leap to a perfect octave."],
                  ["VX", "Voice Crossing", "A higher voice sounds below a lower voice."],
                  ["Sp", "Spacing Error", "Adjacent upper voices are more than an octave apart (or bass-tenor more than two octaves)."],
                  ["2LT", "Doubled Leading Tone", "The leading tone appears in more than one voice."],
                  ["LT\u2191", "Unresolved Leading Tone", "The leading tone in a dominant chord does not resolve up by step to tonic."],
                  ["7\u2193", "Unresolved Chordal 7th", "The 7th of a chord does not resolve down by step."],
                  ["2R", "Root Not Doubled", "In a root-position chord with doublings, the root is not the doubled note."],
                  ["2\u00D75", "Fifth Not Doubled", "In a second-inversion chord with doublings, the fifth (bass note) is not doubled."],
                ].map(([code, name, desc]) => (
                  <tr key={code} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "4px 12px 4px 0", fontWeight: 700, color: "#e74c3c", whiteSpace: "nowrap", verticalAlign: "top" }}>{code}</td>
                    <td style={{ padding: "4px 12px 4px 0", fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap", verticalAlign: "top" }}>{name}</td>
                    <td style={{ padding: "4px 0", color: "#555" }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>Non-Chord Tones</h4>
            <table style={{ width: "100%", fontSize: 13, lineHeight: 1.6, marginBottom: 16, borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["PT", "Passing Tone", "Stepwise motion connecting two chord tones in the same direction."],
                  ["NT", "Neighbor Tone", "Stepwise motion away from and back to the same chord tone."],
                  ["APP", "Appoggiatura", "Approached by leap, resolved by step in the opposite direction."],
                  ["ET", "Escape Tone", "Approached by step, resolved by leap in the opposite direction."],
                  ["CT", "Changing Tone", "A neighbor-tone group that changes direction (double neighbor)."],
                  ["SUS", "Suspension", "A chord tone held over into the next chord, then resolved down by step. Labeled with the intervals (e.g. SUS 4-3)."],
                  ["RET", "Retardation", "Like a suspension, but resolves upward by step."],
                  ["ANT", "Anticipation", "A note that arrives early, sounding before the chord it belongs to."],
                  ["PED", "Pedal Tone", "A sustained or repeated note (usually bass) held through changing harmonies."],
                ].map(([code, name, desc]) => (
                  <tr key={code} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "4px 12px 4px 0", fontWeight: 700, color: "#c0392b", whiteSpace: "nowrap", verticalAlign: "top" }}>{code}</td>
                    <td style={{ padding: "4px 12px 4px 0", fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap", verticalAlign: "top" }}>{name}</td>
                    <td style={{ padding: "4px 0", color: "#555" }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setLegendOpen(false)}
                style={{ padding: "6px 16px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", border: "1px solid #ccc", borderRadius: 4, background: "none" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      </div>{/* end fixed top bar */}

      {/* Spacer for fixed top bar (not needed in embedded/sticky mode) */}
      {!embedded && <div ref={topBarSpacerRef} />}

      {/* Main content: score + optional error panel */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: 16,
        padding: "24px 16px",
        alignItems: "flex-start",
      }}>

      {/* Page card */}
      <div style={{
        maxWidth: 960,
        width: "100%",
        minWidth: 960,
        flex: showErrors && errorPanelOpen ? "1 1 0" : undefined,
        padding: "36px 40px 48px",
        borderRadius: 8,
        boxShadow: dk ? "0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
        zoom: zoom !== 1 ? zoom : undefined,
        transition: "max-width 0.3s ease, background 0.3s ease",
        color: theme.text,
        background: `
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent ${SPACE * 2 - 1}px,
            ${dk ? "rgba(255,255,255,0.03)" : "rgba(180, 160, 130, 0.18)"} ${SPACE * 2 - 1}px,
            ${dk ? "rgba(255,255,255,0.03)" : "rgba(180, 160, 130, 0.18)"} ${SPACE * 2}px
          ),
          ${theme.pageBg}
        `,
      }}>

      {/* Interactive grand staff */}
      <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
      <svg
        ref={svgRef}
        width="100%"
        height={svgHeight}
        viewBox={`0 0 ${staffW} ${svgHeight}`}
        preserveAspectRatio="xMinYMin meet"
        style={{ fontFamily: "serif", cursor: deleteMode ? "not-allowed" : "crosshair", display: "block" }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={() => setOpenRnDropdown(null)}
        onMouseLeave={() => { dragRef.current = null; setHoverDp(null); setHoverStaff(null); setHoverBeatIdx(null); }}
      >
        {Array.from({ length: systemCount }, (_, sysIdx) => {
          const sysY = sysIdx * systemTotalHeight;
          return (
            <g key={`sys-${sysIdx}`} transform={`translate(0, ${sysY})`}>
              {/* Treble staff lines */}
              {ED_TREBLE_LINES.map((dp) => {
                const y = dpToY(dp, ED_TREBLE_TOP, trebleYOffset);
                return <line key={`tl-${dp}`} x1={5} y1={y} x2={staffW - RIGHT_MARGIN} y2={y} stroke="currentColor" strokeWidth={LINE_W} />;
              })}
              {/* Bass staff lines */}
              {ED_BASS_LINES.map((dp) => {
                const y = dpToY(dp, ED_BASS_TOP, bassYOffset);
                return <line key={`bl-${dp}`} x1={5} y1={y} x2={staffW - RIGHT_MARGIN} y2={y} stroke="currentColor" strokeWidth={LINE_W} />;
              })}

              {/* Playback highlight — blue column on the currently playing beat */}
              {/* Error hover highlight */}
              {highlightedBeat !== null && (() => {
                const t = allTimePoints[highlightedBeat];
                const pos = timeToPos.get(t);
                if (!pos || pos.systemIdx !== sysIdx) return null;
                const trebleTopY = dpToY(ED_TREBLE_LINES[4], ED_TREBLE_TOP, trebleYOffset);
                const bassBotY = dpToY(ED_BASS_LINES[0], ED_BASS_TOP, bassYOffset);
                const hw = ED_NOTE_SPACING / 2;
                return (
                  <rect
                    x={pos.x - hw} y={trebleTopY - 4}
                    width={ED_NOTE_SPACING} height={bassBotY - trebleTopY + 8}
                    fill="#ef4444" opacity={0.15} rx={3}
                    style={{ pointerEvents: "none" }}
                  />
                );
              })()}

              {playbackTimeIdx !== null && (() => {
                const t = allTimePoints[playbackTimeIdx];
                const pos = timeToPos.get(t);
                if (!pos || pos.systemIdx !== sysIdx) return null;
                const trebleTopY = dpToY(ED_TREBLE_LINES[4], ED_TREBLE_TOP, trebleYOffset);
                const bassBotY = dpToY(ED_BASS_LINES[0], ED_BASS_TOP, bassYOffset);
                const hw = ED_NOTE_SPACING / 2;
                return (
                  <rect
                    x={pos.x - hw} y={trebleTopY - 4}
                    width={ED_NOTE_SPACING} height={bassBotY - trebleTopY + 8}
                    fill="#3498db" opacity={0.12} rx={3}
                    style={{ pointerEvents: "none" }}
                  />
                );
              })()}

              {/* Playback start position marker — small blue triangle */}
              {!isPlaying && !isPaused && (() => {
                const t = allTimePoints[playbackStartIdx];
                if (t === undefined) return null;
                const pos = timeToPos.get(t);
                if (!pos || pos.systemIdx !== sysIdx) return null;
                const mx = pos.x;
                const my = staffHeight - 4;
                return (
                  <polygon
                    points={`${mx},${my} ${mx - 5},${my + 8} ${mx + 5},${my + 8}`}
                    fill="#3498db" opacity={0.6}
                  />
                );
              })()}

              {/* (playback click areas moved after RN labels) */}

              {/* Clefs */}
              <path d={TREBLE_CLEF_PATH} fill="currentColor" stroke="none"
                transform={`translate(${ED_CLEF_X}, ${dpToY(32, ED_TREBLE_TOP, trebleYOffset)}) scale(${GLYPH_SCALE}, ${-GLYPH_SCALE})`} />
              <path d={BASS_CLEF_PATH} fill="currentColor" stroke="none"
                transform={`translate(${ED_CLEF_X}, ${dpToY(24, ED_BASS_TOP, bassYOffset)}) scale(${GLYPH_SCALE}, ${-GLYPH_SCALE})`} />

              {/* Key signature */}
              {keySig.count > 0 && Array.from({ length: keySig.count }, (_, i) => {
                const trebleDp = keySig.type === "sharp" ? TREBLE_SHARP_DPS[i] : TREBLE_FLAT_DPS[i];
                const bassDp = keySig.type === "sharp" ? BASS_SHARP_DPS[i] : BASS_FLAT_DPS[i];
                const sym = keySig.type === "sharp" ? "\u266F" : "\u266D";
                const kx = CLEF_WIDTH + 4 + i * KS_ACCIDENTAL_W;
                return (
                  <g key={`ks-${i}`}>
                    <text x={kx} y={dpToY(trebleDp, ED_TREBLE_TOP, trebleYOffset) + (keySig.type === "sharp" ? 6 : 4)} fontSize={16} textAnchor="middle"
                      fill="currentColor" stroke="currentColor" strokeWidth={0.5} paintOrder="stroke">{sym}</text>
                    <text x={kx} y={dpToY(bassDp, ED_BASS_TOP, bassYOffset) + (keySig.type === "sharp" ? 6 : 4)} fontSize={16} textAnchor="middle"
                      fill="currentColor" stroke="currentColor" strokeWidth={0.5} paintOrder="stroke">{sym}</text>
                  </g>
                );
              })}

              {/* Time signature — first system only */}
              {sysIdx === 0 && (() => {
                const trebleTopLineY = dpToY(ED_TREBLE_LINES[4], ED_TREBLE_TOP, trebleYOffset);
                const trebleMidLineY = dpToY(ED_TREBLE_LINES[2], ED_TREBLE_TOP, trebleYOffset);
                const trebleBotLineY = dpToY(ED_TREBLE_LINES[0], ED_TREBLE_TOP, trebleYOffset);
                const bassTopLineY = dpToY(ED_BASS_LINES[4], ED_BASS_TOP, bassYOffset);
                const bassMidLineY = dpToY(ED_BASS_LINES[2], ED_BASS_TOP, bassYOffset);
                const bassBotLineY = dpToY(ED_BASS_LINES[0], ED_BASS_TOP, bassYOffset);
                return (
                  <>
                    <TsDigit digit={tsTop} x={edTsX} y={(trebleTopLineY + trebleMidLineY) / 2} />
                    <TsDigit digit={tsBottom} x={edTsX} y={(trebleMidLineY + trebleBotLineY) / 2} />
                    <TsDigit digit={tsTop} x={edTsX} y={(bassTopLineY + bassMidLineY) / 2} />
                    <TsDigit digit={tsBottom} x={edTsX} y={(bassMidLineY + bassBotLineY) / 2} />
                  </>
                );
              })()}

              {/* Barlines */}
              {barlineData.filter((b) => b.systemIdx === sysIdx).map((b, i) => {
                const trebleTopY = dpToY(ED_TREBLE_LINES[4], ED_TREBLE_TOP, trebleYOffset);
                const bassBotY = dpToY(ED_BASS_LINES[0], ED_BASS_TOP, bassYOffset);
                return <line key={`bar-${i}`} x1={b.x} y1={trebleTopY} x2={b.x} y2={bassBotY} stroke="currentColor" strokeWidth={1} />;
              })}

              {/* Placed beats — treble staff */}
              {(() => {
                const trebleLineYs = ED_TREBLE_LINES.map((dp) => dpToY(dp, ED_TREBLE_TOP, trebleYOffset));
                return paddedTrebleBeats.map((beat, i) => {
                  const pos = trebleBeatPositions[i];
                  if (!pos || pos.sys !== sysIdx) return null;
                  const bx = pos.x;
                  if (beat.isRest) {
                    return <g key={`tb-${i}`}>{renderRestOnStaff(beat.duration, bx, trebleLineYs)}</g>;
                  }
                  const tNct = trebleTimes[i] !== undefined ? timeToNct.get(trebleTimes[i]) : undefined;
                  const tNoteErrs = trebleTimes[i] !== undefined ? timeToNoteErrors.get(trebleTimes[i]) : undefined;

                  const drag = dragRef.current;
                  if (drag && drag.staff === "treble" && drag.beatIdx === i && drag.moved) {
                    const filtered: PlacedBeat = {
                      ...beat,
                      notes: beat.notes.filter((n) => n.dp !== drag.note.dp),
                    };
                    return (
                      <g key={`tb-${i}`}>
                        {filtered.notes.length > 0 && renderBeat(filtered, bx, 1, tNct, tNoteErrs)}
                        {renderNotehead(drag.note.dp, beat.duration, bx, ED_TREBLE_TOP, ED_TREBLE_LINES[0], trebleYOffset, drag.note.accidental, 0.2)}
                      </g>
                    );
                  }
                  return <g key={`tb-${i}`}>{renderBeat(beat, bx, 1, tNct, tNoteErrs)}</g>;
                });
              })()}

              {/* Placed beats — bass staff */}
              {(() => {
                const bassLineYs = ED_BASS_LINES.map((dp) => dpToY(dp, ED_BASS_TOP, bassYOffset));
                return paddedBassBeats.map((beat, i) => {
                  const pos = bassBeatPositions[i];
                  if (!pos || pos.sys !== sysIdx) return null;
                  const bx = pos.x;
                  if (beat.isRest) {
                    return <g key={`bb-${i}`}>{renderRestOnStaff(beat.duration, bx, bassLineYs)}</g>;
                  }
                  const bNct = bassTimes[i] !== undefined ? timeToNct.get(bassTimes[i]) : undefined;
                  const bNoteErrs = bassTimes[i] !== undefined ? timeToNoteErrors.get(bassTimes[i]) : undefined;

                  const drag = dragRef.current;
                  if (drag && drag.staff === "bass" && drag.beatIdx === i && drag.moved) {
                    const filtered: PlacedBeat = {
                      ...beat,
                      notes: beat.notes.filter((n) => n.dp !== drag.note.dp),
                    };
                    return (
                      <g key={`bb-${i}`}>
                        {filtered.notes.length > 0 && renderBeat(filtered, bx, 1, bNct, bNoteErrs)}
                        {renderNotehead(drag.note.dp, beat.duration, bx, ED_BASS_TOP, ED_BASS_LINES[0], bassYOffset, drag.note.accidental, 0.2)}
                      </g>
                    );
                  }
                  return <g key={`bb-${i}`}>{renderBeat(beat, bx, 1, bNct, bNoteErrs)}</g>;
                });
              })()}

              {/* Roman numerals + chord errors */}
              {!lessonConfig && allTimePoints.map((t, i) => {
                const rns = activeLabels[i];
                const hasRn = hasRN && rns && rns.length > 0;
                const beatChordErrs = timeToChordErrors.get(t);
                const hasChordErr = beatChordErrs && beatChordErrs.length > 0;
                if (!hasRn && !hasChordErr) return null;
                const pos = timeToPos.get(t);
                if (!pos || pos.systemIdx !== sysIdx) return null;
                const rx = pos.x;
                const rnY = staffHeight + 2;
                const selIdx = rnSelections[i] ?? 0;
                const label = hasRn ? (rns![selIdx] ?? rns![0]) : "";
                const hasAlts = hasRn && rns!.length > 1;
                return (
                  <g key={`rn-${i}`}
                    style={hasAlts ? { cursor: "pointer" } : undefined}
                    onClick={hasAlts ? (e) => { e.stopPropagation(); setOpenRnDropdown(openRnDropdown === i ? null : i); } : undefined}
                  >
                    {hasAlts && (() => {
                      const boxW = Math.max(22, label.length * 9 + 2);
                      return <rect x={rx - boxW / 2} y={rnY + 2} width={boxW} height={26} rx={4} ry={4}
                        fill="none" stroke="#c0bbb5" strokeWidth={1} />;
                    })()}
                    {hasRn && (
                      <text x={rx} y={rnY + 20} fontSize={labelMode === "chord" ? 14 : 16}
                        fontStyle="normal" textAnchor="middle" fill="currentColor"
                        fontFamily={labelMode === "chord" ? "sans-serif" : "serif"}>
                        {label}
                      </text>
                    )}
                    {hasChordErr && (() => {
                      const ceText = beatChordErrs!.join(", ");
                      const ceTip = beatChordErrs!.map(e => errorTooltips[e] || e).join(", ");
                      const ceY = rnY + (hasRn ? 36 : 20);
                      const badgeH = 14;
                      const padX = 4;
                      const ceW = ceText.length * 5.8 + padX * 2 + 2;
                      return (
                        <g className="cp-fade" style={{ opacity: showErrors ? 1 : 0, pointerEvents: showErrors ? "auto" : "none" }}>
                          <title>{ceTip}</title>
                          <rect x={rx - ceW / 2} y={ceY - badgeH + 3} width={ceW} height={badgeH} rx={3} fill={theme.errBadgeBg} />
                          <text x={rx} y={ceY} fontSize={10}
                            textAnchor="middle" fill={theme.errText} fontFamily="sans-serif" fontWeight="700">
                            {ceText}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })}

              {/* Lesson mode: student RN input fields */}
              {lessonConfig && allTimePoints.map((t, i) => {
                const pos = timeToPos.get(t);
                if (!pos || pos.systemIdx !== sysIdx) return null;
                const rx = pos.x;
                const rnY = staffHeight + 4;
                const inputW = 56;
                const inputH = 30;
                return (
                  <foreignObject key={`rn-input-${i}`} x={rx - inputW / 2} y={rnY} width={inputW} height={inputH}>
                    <RnInput
                      value={studentRomans[i] ?? ""}
                      onChange={(v) => setStudentRomans((prev) => ({ ...prev, [i]: v }))}
                      dark={dk}
                    />
                  </foreignObject>
                );
              })}

              {/* Clickable areas to set playback start position — covers RN area + gap below bass staff */}
              {!isPlaying && !isPaused && allTimePoints.map((t, i) => {
                const pos = timeToPos.get(t);
                if (!pos || pos.systemIdx !== sysIdx) return null;
                const bassBotY = dpToY(ED_BASS_LINES[0], ED_BASS_TOP, bassYOffset);
                const hw = ED_NOTE_SPACING / 2;
                return (
                  <rect
                    key={`pb-click-${i}`}
                    x={pos.x - hw} y={bassBotY - 6}
                    width={ED_NOTE_SPACING} height={RN_SPACE + 12}
                    fill="transparent"
                    style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaybackStartIdx(i);
                    }}
                  />
                );
              })}

              {/* Hover ghost note / drag preview */}
              {hoverDp !== null && hoverStaff !== null && hoverBeatIdx !== null && (() => {
                const hoverPos = staffBeatPos(hoverStaff, hoverBeatIdx);
                if (hoverPos.sys !== sysIdx) return null;
                const drag = dragRef.current;
                const isDragging = drag && drag.moved;
                const isTreble = hoverStaff === "treble";
                const sTopDp = isTreble ? ED_TREBLE_TOP : ED_BASS_TOP;
                const sBotDp = isTreble ? ED_TREBLE_LINES[0] : ED_BASS_LINES[0];
                const yOff = isTreble ? trebleYOffset : bassYOffset;

                if (isDragging && drag.staff === hoverStaff) {
                  const dBeats = getDisplayBeats(drag.staff);
                  const positions = drag.staff === "treble" ? trebleBeatPositions : bassBeatPositions;
                  const dur = dBeats[drag.beatIdx]?.duration ?? selectedDuration;
                  const dPos = positions[drag.beatIdx];
                  if (!dPos || dPos.sys !== sysIdx) return null;
                  return renderNotehead(hoverDp, dur, dPos.x, sTopDp, sBotDp, yOff, drag.note.accidental, 0.5);
                }

                const hx = hoverPos.x;
                const displayBeats = getDisplayBeats(hoverStaff);
                const existingBeat = displayBeats[hoverBeatIdx];
                const noteExists = existingBeat && !existingBeat.isRest && existingBeat.notes.some((n) => n.dp === hoverDp);

                if (deleteMode) {
                  const isRest = existingBeat && existingBeat.isRest;
                  if (!noteExists && !isRest) return null;
                  const staffLines = hoverStaff === "treble" ? ED_TREBLE_LINES : ED_BASS_LINES;
                  const midLineY = dpToY(staffLines[2], sTopDp, yOff);
                  const y = isRest ? midLineY : dpToY(hoverDp, sTopDp, yOff);
                  return (
                    <g opacity={0.6}>
                      <line x1={hx - 8} y1={y - 8} x2={hx + 8} y2={y + 8} stroke="red" strokeWidth={2.5} />
                      <line x1={hx - 8} y1={y + 8} x2={hx + 8} y2={y - 8} stroke="red" strokeWidth={2.5} />
                    </g>
                  );
                }

                const wouldRemove = noteExists;
                const ghostDur = (existingBeat && !existingBeat.isRest && existingBeat.duration === selectedDuration) ? existingBeat.duration : selectedDuration;
                return renderNotehead(hoverDp, ghostDur, hx, sTopDp, sBotDp, yOff, selectedAccidental, wouldRemove ? 0.15 : 0.3);
              })()}
            </g>
          );
        })}
      </svg>
      {/* RN dropdown rendered outside SVG so it's not clipped */}
      {openRnDropdown !== null && (() => {
        const i = openRnDropdown;
        const rns = activeLabels[i];
        if (!rns || rns.length < 2) return null;
        const t = allTimePoints[i];
        const pos = timeToPos.get(t);
        if (!pos) return null;
        const selIdx = rnSelections[i] ?? 0;
        const svg = svgRef.current;
        if (!svg) return null;
        const pt = svg.createSVGPoint();
        pt.x = pos.x;
        const rnY = staffHeight + 2 + pos.systemIdx * systemTotalHeight + 24;
        pt.y = rnY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return null;
        const screenPt = pt.matrixTransform(ctm);
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return null;
        const left = screenPt.x - containerRect.left;
        const top = screenPt.y - containerRect.top;
        return (
          <div style={{
            position: "absolute", left, top, transform: "translateX(-50%)",
            background: "#fff", border: "1px solid #d0ccc8", borderRadius: 4,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)", zIndex: 10,
            minWidth: 60,
          }}>
            {rns.map((rn, j) => (
              <div key={j}
                onClick={(e) => {
                  e.stopPropagation();
                  setRnSelections((s) => ({ ...s, [i]: j }));
                  setOpenRnDropdown(null);
                }}
                style={{
                  padding: "4px 10px", fontSize: 15, fontFamily: "serif",
                  textAlign: "center", cursor: "pointer", whiteSpace: "nowrap",
                  background: j === selIdx ? "#eee" : "transparent",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f0efed")}
                onMouseLeave={(e) => (e.currentTarget.style.background = j === selIdx ? "#eee" : "transparent")}
              >
                {rn}
              </div>
            ))}
          </div>
        );
      })()}
      </div>
      </div>{/* end page card */}

      {/* Right-side error panel */}
      {showErrors && errorPanelOpen && (
        <div style={{
          width: 300,
          minWidth: 300,
          maxHeight: "calc(100vh - 120px)",
          position: "sticky",
          top: 80,
          overflowY: "auto",
          borderRadius: 8,
          background: dk ? "#2a2a30" : "#fff",
          boxShadow: dk ? "0 1px 3px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.15)" : "0 1px 3px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)",
          border: `1px solid ${dk ? "#3a3a40" : "#e8e4e0"}`,
          color: theme.text,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          zoom: zoom !== 1 ? zoom : undefined,
        }}>
          {/* Panel header */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 16px 12px",
            borderBottom: `1px solid ${dk ? "#3a3a40" : "#f0ece6"}`,
            position: "sticky", top: 0,
            background: dk ? "#2a2a30" : "#fff",
            borderRadius: "8px 8px 0 0",
            zIndex: 1,
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: theme.text }}>
                Error Summary
              </h3>
              <span style={{
                fontSize: 11, fontWeight: 600, marginTop: 2, display: "block",
                color: errorSummary.length > 0 ? (dk ? "#fbbf24" : "#d97706") : (dk ? "#4ade80" : "#16a34a"),
              }}>
                {errorSummary.length > 0
                  ? `${errorSummary.length} issue${errorSummary.length !== 1 ? "s" : ""} found`
                  : "No issues"}
              </span>
            </div>
            <button
              onClick={() => { setErrorPanelOpen(false); setHighlightedBeat(null); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: theme.textMuted, fontSize: 18, padding: "2px 6px", lineHeight: 1,
              }}
              title="Close panel"
            >
              ×
            </button>
          </div>

          {/* Panel content */}
          <div style={{ padding: "8px 0" }}>
            {errorSummary.length === 0 ? (
              <div style={{
                padding: "32px 16px",
                textAlign: "center",
                color: dk ? "#4ade80" : "#16a34a",
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>No voice-leading errors detected</div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                  Your part writing looks good!
                </div>
              </div>
            ) : (
              errorSummary.map((err, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setHighlightedBeat(err.beat);
                    setPlaybackStartIdx(err.beat);
                    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  onMouseEnter={(e) => {
                    setHighlightedBeat(err.beat);
                    e.currentTarget.style.background = dk ? "#35353c" : "#fef8f8";
                  }}
                  onMouseLeave={(e) => {
                    setHighlightedBeat(null);
                    e.currentTarget.style.background = "transparent";
                  }}
                  style={{
                    padding: "10px 16px",
                    cursor: "pointer",
                    transition: "background 0.15s",
                    borderLeft: `3px solid ${dk ? "#f87171" : "#e74c3c"}`,
                    marginLeft: 0,
                  }}
                >
                  <div style={{ fontSize: 12, color: dk ? "#ddd" : "#222", fontWeight: 600, lineHeight: 1.4, marginBottom: 2 }}>
                    {err.fullName}
                  </div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>
                    {err.location}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      </div>{/* end flex container */}

      {header && <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: dk ? "#222228" : "#f0ede9", borderTop: `1px solid ${theme.footerBorder}`, color: theme.text,
      }}>
        {lessonConfig && <RnLegend dark={dk} />}
        <div style={{ padding: "16px 24px", paddingTop: lessonConfig ? 8 : 16 }}>{header}</div>
      </div>}
    </div>
  );
}

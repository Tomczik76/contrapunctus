import { useState, useRef, useCallback, useMemo } from "react";
import type { RenderData, NoteRender, BeatRender, Staff as StaffDef, ContrapunctusApi } from "../contrapunctus";
import { Contrapunctus } from "contrapunctus";

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
const STAFF_GAP = 90;
/** Staff line thickness. */
const LINE_W = 1;
/** Ledger line half-width. */
const LEDGER_HW = 8;
/** Stem length in pixels (VexFlow default is 35 at 10px spacing). */
const STEM_HEIGHT = 35 * (SPACE / 10);
/** Stem thickness. */
const STEM_W = 1.5;

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

// Outline x-extents are measured from the actual path coordinates, not the font metadata.
const NOTEHEAD_WHOLE = {
  outlineXMin: 0, outlineXMax: 608,
  path: vexOutlineToSvgPath('m 311 180 b 0 3 120 180 0 101 b 297 -180 0 -94 82 -180 b 608 3 533 -180 608 -98 b 311 180 608 105 445 180 z m 160 91 b 274 148 176 141 229 148 b 452 -45 373 148 452 42 b 386 -141 452 -89 433 -130 b 341 -147 372 -145 356 -147 b 206 -72 289 -147 236 -112 b 156 56 177 -39 156 10 b 160 91 156 68 157 79 z'),
};

const NOTEHEAD_HALF = {
  outlineXMin: 0, outlineXMax: 425,
  path: vexOutlineToSvgPath('m 140 -180 b 425 60 377 -180 425 13 b 282 180 425 134 366 180 b 0 -60 68 180 0 14 b 140 -180 0 -137 60 -180 z m 108 -125 b 50 -92 78 -125 60 -109 b 42 -63 46 -84 42 -73 b 318 121 42 7 251 121 b 372 91 346 121 361 108 b 380 63 376 82 380 73 b 108 -125 380 1 177 -125 z'),
};

const NOTEHEAD_BLACK = {
  outlineXMin: 0, outlineXMax: 425,
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

  // Stem attaches to right edge (stem up) or left edge (stem down) of notehead
  const stemX = stemDown ? x - headW / 2 : x + headW / 2;
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
        <text x={x - headW / 2 - 3} y={y + 4} fontSize={14} textAnchor="end" fill="currentColor">
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

type Duration = "whole" | "half" | "quarter" | "eighth" | "sixteenth";

/** A beat contains one or more notes (a chord) with a shared duration. */
type Accidental = "" | "#" | "b";

interface PlacedNote {
  dp: number;
  staff: "treble" | "bass";
  accidental: Accidental;
}

interface PlacedBeat {
  notes: PlacedNote[];
  duration: Duration;
  isRest?: boolean;
}

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

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
const ED_NOTE_SPACING = 45;
const ED_BARLINE_GAP = 12;

/** Fraction of a whole note for each duration. */
const DURATION_VALUE: Record<Duration, number> = {
  whole: 1,
  half: 1 / 2,
  quarter: 1 / 4,
  eighth: 1 / 8,
  sixteenth: 1 / 16,
};

/** Which durations fit in a given remaining measure space. */
function durationFits(dur: Duration, remaining: number): boolean {
  return DURATION_VALUE[dur] <= remaining + 1e-9;
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
      const val = DURATION_VALUE[beats[i].duration];
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
    used += DURATION_VALUE[beats[i].duration];
  }
  const rem = measureCapacity - used;
  return rem < 1e-9 ? measureCapacity : rem; // if full, next beat starts a new measure
}

/** Fill remaining space in a measure with the largest rests that fit. */
function fillWithRests(remaining: number): PlacedBeat[] {
  const rests: PlacedBeat[] = [];
  const durs: Duration[] = ["whole", "half", "quarter", "eighth", "sixteenth"];
  let left = remaining;
  while (left > 1e-9) {
    const dur = durs.find((d) => DURATION_VALUE[d] <= left + 1e-9);
    if (!dur) break;
    rests.push({ notes: [], duration: dur, isRest: true });
    left -= DURATION_VALUE[dur];
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
    used += DURATION_VALUE[beats[i].duration];
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
      usedAfterTrim += DURATION_VALUE[trimmed[i].duration];
    }
    const remAfterTrim = measureCap - usedAfterTrim;
    if (remAfterTrim > 1e-9) {
      return [...trimmed, ...fillWithRests(remAfterTrim)];
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
    t += DURATION_VALUE[b.duration];
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

function getKeySig(tonicIdx: number, scaleName: string): { count: number; type: "sharp" | "flat" | "none" } {
  const sigs = scaleName === "major" ? MAJOR_KEY_SIGS : MINOR_KEY_SIGS;
  const val = sigs[tonicIdx] ?? 0;
  if (val > 0) return { count: val, type: "sharp" };
  if (val < 0) return { count: -val, type: "flat" };
  return { count: 0, type: "none" };
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
  { label: "Harmonic Minor", value: "harmonicMinor" },
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

  const stemX = headCx + headW / 2;
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

export function NoteEditor() {
  const [selectedDuration, setSelectedDuration] = useState<Duration>("quarter");
  const [selectedAccidental, setSelectedAccidental] = useState<Accidental>("");
  const [deleteMode, setDeleteMode] = useState(false);
  const [restMode, setRestMode] = useState(false);
  const [tsTop, setTsTop] = useState(4);
  const [tsBottom, setTsBottom] = useState(4);

  // Independent beat arrays for each staff
  const [trebleBeats, setTrebleBeatsRaw] = useState<PlacedBeat[]>(() => fillWithRests(4 / 4));
  const [bassBeats, setBassBeatsRaw] = useState<PlacedBeat[]>(() => fillWithRests(4 / 4));

  const setTrebleBeats: typeof setTrebleBeatsRaw = useCallback((action) => {
    setTrebleBeatsRaw((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      return autoFillBeats(next, tsTop, tsBottom);
    });
  }, [tsTop, tsBottom]);

  const setBassBeats: typeof setBassBeatsRaw = useCallback((action) => {
    setBassBeatsRaw((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      return autoFillBeats(next, tsTop, tsBottom);
    });
  }, [tsTop, tsBottom]);

  /** Get the setter for the given staff. */
  function setStaffBeats(staff: "treble" | "bass") {
    return staff === "treble" ? setTrebleBeats : setBassBeats;
  }
  function getStaffBeats(staff: "treble" | "bass") {
    return staff === "treble" ? trebleBeats : bassBeats;
  }

  const [hoverDp, setHoverDp] = useState<number | null>(null);
  const [hoverStaff, setHoverStaff] = useState<"treble" | "bass" | null>(null);
  const [hoverBeatIdx, setHoverBeatIdx] = useState<number | null>(null);
  const [tonicIdx, setTonicIdx] = useState(0); // C
  const [scaleName, setScaleName] = useState("major");
  const svgRef = useRef<SVGSVGElement>(null);

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

  // Time-based beat positioning
  const trebleTimes = useMemo(() => beatTimeOffsets(trebleBeats), [trebleBeats]);
  const bassTimes = useMemo(() => beatTimeOffsets(bassBeats), [bassBeats]);

  const allTimePoints = useMemo(() => {
    const set = new Set<number>();
    trebleTimes.forEach((t) => set.add(t));
    bassTimes.forEach((t) => set.add(t));
    return [...set].sort((a, b) => a - b);
  }, [trebleTimes, bassTimes]);

  // X positions: each unique time column gets equal spacing, with barline gaps
  const timeToX = useMemo(() => {
    const measureCap = timeKey(tsTop / tsBottom);
    const map = new Map<number, number>();
    let x = edLeft + ED_NOTE_SPACING / 2;
    for (const t of allTimePoints) {
      // Check if we crossed a measure boundary since the last time point
      const measureIdx = Math.floor(t / measureCap + 1e-9);
      if (measureIdx > 0 && map.size > 0) {
        const boundary = timeKey(measureIdx * measureCap);
        // If t is exactly at a boundary and the previous time point was in the previous measure
        const prevEntries = [...map.entries()];
        const lastEntry = prevEntries[prevEntries.length - 1];
        if (lastEntry) {
          const prevMeasure = Math.floor(lastEntry[0] / measureCap + 1e-9);
          if (measureIdx > prevMeasure) {
            x += ED_BARLINE_GAP;
          }
        }
      }
      map.set(t, x);
      x += ED_NOTE_SPACING;
    }
    return map;
  }, [allTimePoints, edLeft, tsTop, tsBottom]);

  const trebleBeatPositions = useMemo(() =>
    trebleTimes.map((t) => timeToX.get(t) ?? edLeft),
    [trebleTimes, timeToX]
  );
  const bassBeatPositions = useMemo(() =>
    bassTimes.map((t) => timeToX.get(t) ?? edLeft),
    [bassTimes, timeToX]
  );

  // Barlines at measure boundaries
  const barlineXs = useMemo(() => {
    const measureCap = timeKey(tsTop / tsBottom);
    const xs: number[] = [];
    for (let k = 1; ; k++) {
      const boundary = timeKey(k * measureCap);
      // Find time points just before and after boundary
      let beforeX: number | null = null;
      let afterX: number | null = null;
      for (const t of allTimePoints) {
        if (t < boundary - 1e-9) beforeX = timeToX.get(t)!;
        if (t >= boundary - 1e-9 && afterX === null) afterX = timeToX.get(t)!;
      }
      if (beforeX === null || afterX === null) break;
      xs.push((beforeX + afterX) / 2);
    }
    return xs;
  }, [allTimePoints, timeToX, tsTop, tsBottom]);

  const totalWidth = useMemo(() => {
    if (allTimePoints.length === 0) return 600;
    const lastX = timeToX.get(allTimePoints[allTimePoints.length - 1])!;
    return Math.max(lastX + ED_NOTE_SPACING + RIGHT_MARGIN, 600);
  }, [allTimePoints, timeToX]);

  /** Get x for a beat index on a staff (existing or new). */
  function staffBeatX(staff: "treble" | "bass", idx: number): number {
    const positions = staff === "treble" ? trebleBeatPositions : bassBeatPositions;
    if (idx < positions.length) return positions[idx];
    // New beat: past the end
    if (positions.length === 0) return edLeft + ED_NOTE_SPACING / 2;
    return positions[positions.length - 1] + ED_NOTE_SPACING;
  }

  // Compute Roman numeral analysis by merging notes at each time point
  const romanNumerals = useMemo(() => {
    if (trebleBeats.length === 0 && bassBeats.length === 0) return [];
    const tonic = TONIC_OPTIONS[tonicIdx];
    try {
      const measureCap = timeKey(tsTop / tsBottom);
      // Group time points into measures
      const measures: { time: number; notes: PlacedNote[] }[][] = [];
      let currentMeasure: { time: number; notes: PlacedNote[] }[] = [];
      for (const t of allTimePoints) {
        const measureIdx = Math.floor(t / measureCap + 1e-9);
        if (measureIdx >= measures.length + 1 && currentMeasure.length > 0) {
          measures.push(currentMeasure);
          currentMeasure = [];
        }
        const notes: PlacedNote[] = [];
        const ti = trebleTimes.indexOf(t);
        if (ti >= 0 && !trebleBeats[ti].isRest) notes.push(...trebleBeats[ti].notes);
        const bi = bassTimes.indexOf(t);
        if (bi >= 0 && !bassBeats[bi].isRest) notes.push(...bassBeats[bi].notes);
        currentMeasure.push({ time: t, notes });
      }
      if (currentMeasure.length > 0) measures.push(currentMeasure);

      const jMeasures = measures.map((m) => {
        const jBeats = m.map((tb) => {
          if (tb.notes.length === 0) return C.rest();
          const notes = tb.notes.map((n) => {
            const letterIdx = ((n.dp % 7) + 7) % 7;
            const octave = Math.floor(n.dp / 7);
            return C.note(LETTERS[letterIdx], n.accidental, octave);
          });
          return C.beat(notes);
        });
        return C.measure(tsTop, tsBottom, jBeats);
      });
      if (jMeasures.length === 0) return [];
      const data = C.renderWithAnalysis(jMeasures, tonic.letter, tonic.acc, scaleName);
      return data.measures.flatMap((m) => m.beats.map((b) => b.romanNumerals));
    } catch {
      return [];
    }
  }, [trebleBeats, bassBeats, trebleTimes, bassTimes, allTimePoints, tonicIdx, scaleName, tsTop, tsBottom]);

  const [rnSelections, setRnSelections] = useState<Record<number, number>>({});

  const hasRN = romanNumerals.some((rn) => rn.length > 0);
  const RN_SPACE_ED = hasRN ? 32 : 0;
  const editorStaffHeight = staffHeight + RN_SPACE_ED;

  /** Convert mouse x to the nearest beat index for a given staff. */
  function xToBeatIdx(mouseX: number, staff: "treble" | "bass"): number {
    const positions = staff === "treble" ? trebleBeatPositions : bassBeatPositions;
    const staffBeats = staff === "treble" ? trebleBeats : bassBeats;
    if (staffBeats.length === 0) return 0;
    // Only allow "new beat past the end" if the last measure is fully composed (no trailing rests)
    const hasTrailingRest = staffBeats[staffBeats.length - 1].isRest;
    let closest = 0;
    let closestDist = Infinity;
    if (!hasTrailingRest) {
      const newX = staffBeatX(staff, staffBeats.length);
      closest = staffBeats.length;
      closestDist = Math.abs(mouseX - newX);
    }
    for (let i = 0; i < positions.length; i++) {
      const dist = Math.abs(mouseX - positions[i]);
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
    const mouseY = e.clientY - rect.top;
    const mouseX = e.clientX - rect.left;
    const { dp, staff } = yToDpAndStaff(mouseY);
    if (dp >= displayBotDp && dp <= displayTopDp) {
      setHoverDp(dp);
      setHoverStaff(staff);
      setHoverBeatIdx(xToBeatIdx(mouseX, staff));
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
  }, [yToDpAndStaff, trebleBeatPositions, bassBeatPositions]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (hoverDp === null || hoverBeatIdx === null || hoverStaff === null) return;
    if (deleteMode) return;
    const beats = getStaffBeats(hoverStaff);
    if (hoverBeatIdx < beats.length) {
      const beat = beats[hoverBeatIdx];
      const existing = beat.notes.find((n) => n.dp === hoverDp);
      if (existing) {
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
  }, [hoverDp, hoverStaff, hoverBeatIdx, trebleBeats, bassBeats, deleteMode]);

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
      setter((prev) => {
        if (hoverBeatIdx >= prev.length) return prev;
        const beat = prev[hoverBeatIdx];
        if (beat.isRest) return prev;
        if (!beat.notes.some(posMatch)) return prev;
        const newNotes = beat.notes.filter((n) => !posMatch(n));
        if (newNotes.length === 0) {
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
      if (hoverBeatIdx < prev.length) {
        const beat = prev[hoverBeatIdx];
        if (beat.isRest) {
          const measures = computeMeasures(prev, tsTop, tsBottom);
          const measure = measures.find((m) => hoverBeatIdx >= m.startIdx && hoverBeatIdx < m.startIdx + m.count);
          if (!measure) return prev;
          const restStart = hoverBeatIdx;
          const measureEnd = measure.startIdx + measure.count;
          let available = 0;
          for (let i = restStart; i < measureEnd; i++) {
            if (prev[i].isRest) available += DURATION_VALUE[prev[i].duration];
            else break;
          }
          if (!durationFits(selectedDuration, available)) return prev;
          let restsToRemove = 0;
          let spaceFreed = 0;
          for (let i = restStart; i < measureEnd && prev[i].isRest; i++) {
            restsToRemove++;
            spaceFreed += DURATION_VALUE[prev[i].duration];
          }
          const newBeat: PlacedBeat = { notes: [hoverNote], duration: selectedDuration };
          const leftover = spaceFreed - DURATION_VALUE[selectedDuration];
          const fillerRests = leftover > 1e-9 ? fillWithRests(leftover) : [];
          return [
            ...prev.slice(0, restStart),
            newBeat,
            ...fillerRests,
            ...prev.slice(restStart + restsToRemove),
          ];
        }
        const existing = beat.notes.find(posMatch);
        if (existing) {
          if (existing.accidental === selectedAccidental) {
            const newNotes = beat.notes.filter((n) => !posMatch(n));
            if (newNotes.length === 0) {
              const updated = [...prev];
              updated[hoverBeatIdx] = { notes: [], duration: beat.duration, isRest: true };
              return updated;
            }
            const updated = [...prev];
            updated[hoverBeatIdx] = { ...beat, notes: newNotes };
            return updated;
          }
          const updated = [...prev];
          updated[hoverBeatIdx] = { ...beat, notes: beat.notes.map((n) => posMatch(n) ? hoverNote : n) };
          return updated;
        }
        const updated = [...prev];
        updated[hoverBeatIdx] = { ...beat, notes: [...beat.notes, hoverNote] };
        return updated;
      }
      // Past the end — start a new measure
      return [...prev, { notes: [hoverNote], duration: selectedDuration }];
    });
  }, [hoverDp, hoverStaff, hoverBeatIdx, selectedDuration, selectedAccidental, deleteMode, restMode, tsTop, tsBottom, trebleBeats, bassBeats]);

  const handleUndo = useCallback(() => {
    // Undo last note on whichever staff had the most recent note
    // For simplicity, undo on both staves' last note
    const undoOnStaff = (prev: PlacedBeat[]) => {
      if (prev.length === 0) return prev;
      let lastNoteIdx = prev.length - 1;
      while (lastNoteIdx >= 0 && prev[lastNoteIdx].isRest) lastNoteIdx--;
      if (lastNoteIdx < 0) return prev;
      const last = prev[lastNoteIdx];
      if (last.notes.length > 1) {
        const updated = [...prev];
        updated[lastNoteIdx] = { ...last, notes: last.notes.slice(0, -1) };
        return updated;
      }
      return [...prev.slice(0, lastNoteIdx), ...prev.slice(lastNoteIdx + 1)];
    };
    // Undo on the staff that was last hovered, or both
    if (hoverStaff === "treble") setTrebleBeats(undoOnStaff);
    else if (hoverStaff === "bass") setBassBeats(undoOnStaff);
    else { setTrebleBeats(undoOnStaff); setBassBeats(undoOnStaff); }
  }, [hoverStaff, setTrebleBeats, setBassBeats]);

  const handleClear = useCallback(() => {
    const fresh = fillWithRests(tsTop / tsBottom);
    setTrebleBeatsRaw(fresh);
    setBassBeatsRaw([...fresh.map((b) => ({ ...b }))]);
  }, [tsTop, tsBottom]);

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
    const accSym = accidentalSymbol(acc);

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
          <text x={x - headW / 2 - 3} y={y + 4} fontSize={14} textAnchor="end" fill="currentColor">{accSym}</text>
        )}
        <path d={head.path} fill="currentColor" stroke="none"
          transform={`translate(${headX}, ${y}) scale(${s}, ${-s})`} />
      </g>
    );
  }

  /** Render a complete beat (chord) with shared stem and flag. */
  function renderBeat(beat: PlacedBeat, x: number, opacity = 1) {
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

    // Render treble notes
    if (trebleNotes.length > 0) {
      const dps = trebleNotes.map((n) => n.dp);
      const avgDp = dps.reduce((a, b) => a + b, 0) / dps.length;
      const stemDown = avgDp >= ED_TREBLE_MID;
      const stemX = stemDown ? x - headW / 2 : x + headW / 2;
      const topDp = Math.max(...dps);
      const botDp = Math.min(...dps);
      const topY = dpToY(topDp, ED_TREBLE_TOP, trebleYOffset);
      const botY = dpToY(botDp, ED_TREBLE_TOP, trebleYOffset);
      const stemEndY = stemDown
        ? Math.max(botY + STEM_HEIGHT, dpToY(ED_TREBLE_LINES[0], ED_TREBLE_TOP, trebleYOffset))
        : Math.min(topY - STEM_HEIGHT, dpToY(ED_TREBLE_TOP, ED_TREBLE_TOP, trebleYOffset));
      const stemBaseY = stemDown ? topY : botY;

      trebleNotes.forEach((n, i) => {
        elements.push(
          <g key={`t-${i}`}>
            {renderNotehead(n.dp, dur, x, ED_TREBLE_TOP, ED_TREBLE_LINES[0], trebleYOffset, n.accidental, opacity)}
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
      const avgDp = dps.reduce((a, b) => a + b, 0) / dps.length;
      const stemDown = avgDp >= ED_BASS_MID;
      const stemX = stemDown ? x - headW / 2 : x + headW / 2;
      const topDp = Math.max(...dps);
      const botDp = Math.min(...dps);
      const topY = dpToY(topDp, ED_BASS_TOP, bassYOffset);
      const botY = dpToY(botDp, ED_BASS_TOP, bassYOffset);
      const stemEndY = stemDown
        ? Math.max(botY + STEM_HEIGHT, dpToY(ED_BASS_BOT, ED_BASS_TOP, bassYOffset))
        : Math.min(topY - STEM_HEIGHT, dpToY(ED_BASS_TOP, ED_BASS_TOP, bassYOffset));
      const stemBaseY = stemDown ? topY : botY;

      bassNotes.forEach((n, i) => {
        elements.push(
          <g key={`b-${i}`}>
            {renderNotehead(n.dp, dur, x, ED_BASS_TOP, ED_BASS_LINES[0], bassYOffset, n.accidental, opacity)}
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

    return <g>{elements}</g>;
  }

  const durations: Duration[] = ["whole", "half", "quarter", "eighth", "sixteenth"];

  const btnBase: React.CSSProperties = {
    width: 36, height: 36,
    borderRadius: 4,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  };
  const btnOn = (on: boolean): React.CSSProperties => ({
    ...btnBase,
    border: on ? "2px solid #333" : "1px solid #aaa",
    background: on ? "#e0e0e0" : "#fff",
  });

  return (
    <div>
      {/* Duration buttons */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        {durations.map((key) => (
          <button key={key} onClick={() => setSelectedDuration(key)}
            style={btnOn(selectedDuration === key)} title={key}>
            <NoteIcon duration={key} size={28} />
          </button>
        ))}
        <div style={{ width: 1, height: 36, background: "#ccc", margin: "0 2px" }} />
        {([["", "\u266E"], ["#", "\u266F"], ["b", "\u266D"]] as [Accidental, string][]).map(([acc, sym]) => (
          <button key={acc || "nat"} onClick={() => setSelectedAccidental(acc)}
            style={{ ...btnOn(selectedAccidental === acc), fontSize: 20 }}
            title={acc === "#" ? "Sharp" : acc === "b" ? "Flat" : "Natural"}>
            {sym}
          </button>
        ))}
        <div style={{ width: 1, height: 36, background: "#ccc", margin: "0 2px" }} />
        <button
          onClick={() => { setRestMode((r) => !r); setDeleteMode(false); }}
          style={{
            ...btnBase,
            width: "auto",
            padding: "0 10px",
            fontSize: 13,
            border: restMode ? "2px solid #333" : "1px solid #aaa",
            background: restMode ? "#e0e0e0" : "#fff",
          }}
          title="Rest mode — click a note/chord to replace it with a rest"
        >
          Rest
        </button>
        <button
          onClick={() => { setDeleteMode((d) => !d); setRestMode(false); }}
          style={{
            ...btnBase,
            width: "auto",
            padding: "0 10px",
            fontSize: 13,
            border: deleteMode ? "2px solid #c00" : "1px solid #aaa",
            background: deleteMode ? "#fee" : "#fff",
            color: deleteMode ? "#c00" : "inherit",
          }}
          title="Toggle delete mode — click notes to remove them"
        >
          Delete
        </button>
        <button onClick={handleUndo} style={{ ...btnBase, width: "auto", padding: "0 10px", fontSize: 13 }} title="Undo last note">
          Undo
        </button>
        <button onClick={handleClear} style={{ ...btnBase, width: "auto", padding: "0 10px", fontSize: 13 }} title="Clear all">
          Clear
        </button>
        <div style={{ width: 1, height: 36, background: "#ccc", margin: "0 2px" }} />
        <label style={{ fontFamily: "serif", fontSize: 14 }}>
          <select
            value={tsTop}
            onChange={(e) => setTsTop(Number(e.target.value))}
            style={{ fontFamily: "serif", fontSize: 14, padding: "2px 4px", width: 40 }}
          >
            {[2, 3, 4, 5, 6, 7, 8, 9, 12].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          {" / "}
          <select
            value={tsBottom}
            onChange={(e) => setTsBottom(Number(e.target.value))}
            style={{ fontFamily: "serif", fontSize: 14, padding: "2px 4px", width: 40 }}
          >
            {[2, 4, 8, 16].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <div style={{ width: 1, height: 36, background: "#ccc", margin: "0 2px" }} />
        <label style={{ fontFamily: "serif", fontSize: 14 }}>
          Key:{" "}
          <select
            value={tonicIdx}
            onChange={(e) => setTonicIdx(Number(e.target.value))}
            style={{ fontFamily: "serif", fontSize: 14, padding: "2px 4px" }}
          >
            {TONIC_OPTIONS.map((t, i) => (
              <option key={t.label} value={i}>{t.label}</option>
            ))}
          </select>
        </label>
        <label style={{ fontFamily: "serif", fontSize: 14 }}>
          <select
            value={scaleName}
            onChange={(e) => setScaleName(e.target.value)}
            style={{ fontFamily: "serif", fontSize: 14, padding: "2px 4px" }}
          >
            {SCALE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ height: 20, marginBottom: 4, fontFamily: "serif", fontSize: 14, color: "#666" }}>
        {hoverDp !== null ? `${dpToNoteName(hoverDp)}${accidentalSymbol(selectedAccidental)}` : "\u00A0"}
      </div>

      {/* Interactive grand staff */}
      <svg
        ref={svgRef}
        width={totalWidth}
        height={editorStaffHeight}
        viewBox={`0 0 ${totalWidth} ${editorStaffHeight}`}
        style={{ fontFamily: "serif", cursor: deleteMode ? "not-allowed" : "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { dragRef.current = null; setHoverDp(null); setHoverStaff(null); setHoverBeatIdx(null); }}
      >
        {/* Treble staff lines */}
        {ED_TREBLE_LINES.map((dp) => {
          const y = dpToY(dp, ED_TREBLE_TOP, trebleYOffset);
          return <line key={`tl-${dp}`} x1={5} y1={y} x2={totalWidth - RIGHT_MARGIN} y2={y} stroke="currentColor" strokeWidth={LINE_W} />;
        })}
        {/* Bass staff lines */}
        {ED_BASS_LINES.map((dp) => {
          const y = dpToY(dp, ED_BASS_TOP, bassYOffset);
          return <line key={`bl-${dp}`} x1={5} y1={y} x2={totalWidth - RIGHT_MARGIN} y2={y} stroke="currentColor" strokeWidth={LINE_W} />;
        })}

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
          const x = CLEF_WIDTH + 4 + i * KS_ACCIDENTAL_W;
          return (
            <g key={`ks-${i}`}>
              <text x={x} y={dpToY(trebleDp, ED_TREBLE_TOP, trebleYOffset) + 4} fontSize={14} textAnchor="middle" fill="currentColor">{sym}</text>
              <text x={x} y={dpToY(bassDp, ED_BASS_TOP, bassYOffset) + 4} fontSize={14} textAnchor="middle" fill="currentColor">{sym}</text>
            </g>
          );
        })}

        {/* Time signature */}
        {(() => {
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
        {barlineXs.map((bx, i) => {
          const trebleTopY = dpToY(ED_TREBLE_LINES[4], ED_TREBLE_TOP, trebleYOffset);
          const bassBotY = dpToY(ED_BASS_LINES[0], ED_BASS_TOP, bassYOffset);
          return <line key={`bar-${i}`} x1={bx} y1={trebleTopY} x2={bx} y2={bassBotY} stroke="currentColor" strokeWidth={1} />;
        })}

        {/* Placed beats — treble staff */}
        {(() => {
          const trebleLineYs = ED_TREBLE_LINES.map((dp) => dpToY(dp, ED_TREBLE_TOP, trebleYOffset));
          return trebleBeats.map((beat, i) => {
            const x = trebleBeatPositions[i];
            if (beat.isRest) {
              return <g key={`tb-${i}`}>{renderRestOnStaff(beat.duration, x, trebleLineYs)}</g>;
            }
            const drag = dragRef.current;
            if (drag && drag.staff === "treble" && drag.beatIdx === i && drag.moved) {
              const filtered: PlacedBeat = {
                ...beat,
                notes: beat.notes.filter((n) => n.dp !== drag.note.dp),
              };
              return (
                <g key={`tb-${i}`}>
                  {filtered.notes.length > 0 && renderBeat(filtered, x)}
                  {renderNotehead(drag.note.dp, beat.duration, x, ED_TREBLE_TOP, ED_TREBLE_LINES[0], trebleYOffset, drag.note.accidental, 0.2)}
                </g>
              );
            }
            return <g key={`tb-${i}`}>{renderBeat(beat, x)}</g>;
          });
        })()}

        {/* Placed beats — bass staff */}
        {(() => {
          const bassLineYs = ED_BASS_LINES.map((dp) => dpToY(dp, ED_BASS_TOP, bassYOffset));
          return bassBeats.map((beat, i) => {
            const x = bassBeatPositions[i];
            if (beat.isRest) {
              return <g key={`bb-${i}`}>{renderRestOnStaff(beat.duration, x, bassLineYs)}</g>;
            }
            const drag = dragRef.current;
            if (drag && drag.staff === "bass" && drag.beatIdx === i && drag.moved) {
              const filtered: PlacedBeat = {
                ...beat,
                notes: beat.notes.filter((n) => n.dp !== drag.note.dp),
              };
              return (
                <g key={`bb-${i}`}>
                  {filtered.notes.length > 0 && renderBeat(filtered, x)}
                  {renderNotehead(drag.note.dp, beat.duration, x, ED_BASS_TOP, ED_BASS_LINES[0], bassYOffset, drag.note.accidental, 0.2)}
                </g>
              );
            }
            return <g key={`bb-${i}`}>{renderBeat(beat, x)}</g>;
          });
        })()}

        {/* Roman numerals */}
        {hasRN && allTimePoints.map((t, i) => {
          const rns = romanNumerals[i];
          if (!rns || rns.length === 0) return null;
          const x = timeToX.get(t)!;
          const rnY = editorStaffHeight - RN_SPACE_ED + 2;
          const selIdx = rnSelections[i] ?? 0;
          if (rns.length === 1) {
            return (
              <text
                key={`rn-${i}`}
                x={x}
                y={rnY + 20}
                fontSize={18}
                fontStyle="normal"
                textAnchor="middle"
                fill="currentColor"
                fontFamily="serif"
              >
                {rns[0]}
              </text>
            );
          }
          const foW = 68;
          const foH = 28;
          return (
            <foreignObject
              key={`rn-${i}`}
              x={x - foW / 2}
              y={rnY}
              width={foW}
              height={foH}
            >
              <select
                value={selIdx}
                onChange={(e) => setRnSelections((s) => ({ ...s, [i]: Number(e.target.value) }))}
                style={{
                  width: "100%",
                  height: foH,
                  fontSize: 16,
                  fontFamily: "serif",
                  textAlign: "center",
                  textAlignLast: "center",
                  border: "1px solid #ccc",
                  borderRadius: 3,
                  background: "#fff",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                {rns.map((rn, j) => (
                  <option key={j} value={j}>{rn}</option>
                ))}
              </select>
            </foreignObject>
          );
        })}

        {/* Hover ghost note / drag preview */}
        {hoverDp !== null && hoverStaff !== null && hoverBeatIdx !== null && (() => {
          const drag = dragRef.current;
          const isDragging = drag && drag.moved;
          const isTreble = hoverStaff === "treble";
          const sTopDp = isTreble ? ED_TREBLE_TOP : ED_BASS_TOP;
          const sBotDp = isTreble ? ED_TREBLE_LINES[0] : ED_BASS_LINES[0];
          const yOff = isTreble ? trebleYOffset : bassYOffset;

          if (isDragging && drag.staff === hoverStaff) {
            const staffBeats = getStaffBeats(drag.staff);
            const positions = drag.staff === "treble" ? trebleBeatPositions : bassBeatPositions;
            const dur = staffBeats[drag.beatIdx]?.duration ?? selectedDuration;
            const x = positions[drag.beatIdx];
            return renderNotehead(hoverDp, dur, x, sTopDp, sBotDp, yOff, drag.note.accidental, 0.5);
          }

          const x = staffBeatX(hoverStaff, hoverBeatIdx);
          const staffBeats = getStaffBeats(hoverStaff);
          const existingBeat = staffBeats[hoverBeatIdx];
          const noteExists = existingBeat && !existingBeat.isRest && existingBeat.notes.some((n) => n.dp === hoverDp);

          if (deleteMode) {
            if (!noteExists) return null;
            const y = dpToY(hoverDp, sTopDp, yOff);
            return (
              <g opacity={0.6}>
                <line x1={x - 8} y1={y - 8} x2={x + 8} y2={y + 8} stroke="red" strokeWidth={2.5} />
                <line x1={x - 8} y1={y + 8} x2={x + 8} y2={y - 8} stroke="red" strokeWidth={2.5} />
              </g>
            );
          }

          const wouldRemove = noteExists;
          const ghostDur = (existingBeat && !existingBeat.isRest) ? existingBeat.duration : selectedDuration;
          return renderNotehead(hoverDp, ghostDur, x, sTopDp, sBotDp, yOff, selectedAccidental, wouldRemove ? 0.15 : 0.3);
        })()}
      </svg>
    </div>
  );
}

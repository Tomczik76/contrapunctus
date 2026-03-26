import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { RenderData, NoteRender, BeatRender, Staff as StaffDef, ContrapunctusApi } from "../../contrapunctus";
import { Contrapunctus } from "contrapunctus";
import { useAuth, API_BASE } from "../../auth";
import type * as ToneNs from "tone";

import {
  STEP, SPACE, BEAT_WIDTH, CLEF_WIDTH, TS_WIDTH, LEFT_MARGIN, RIGHT_MARGIN,
  STAFF_GAP, LINE_W, LEDGER_HW, STEM_HEIGHT, STEM_W, SYSTEM_GAP_V,
} from "./constants";
import type { Duration, Accidental, PlacedNote, PlacedBeat, LessonConfig, LessonErrorItem, NoteEditorProps } from "./types";
import {
  GLYPH_SCALE, TREBLE_CLEF_PATH, BASS_CLEF_PATH, TS_DIGIT_GLYPHS, vexOutlineToSvgPath,
  NOTEHEAD_WHOLE, NOTEHEAD_HALF, NOTEHEAD_BLACK,
  FLAG_8TH_UP, FLAG_8TH_DOWN, FLAG_16TH_UP, FLAG_16TH_DOWN,
  REST_QUARTER, REST_8TH, REST_16TH,
} from "./glyphs";
import {
  dpToY, accidentalSymbol, middleLine, durationCategory,
  LETTERS, LETTER_SEMITONES, dpToMidi, dpToNoteName,
  ED_TREBLE_LINES, ED_BASS_LINES, ED_TREBLE_TOP, ED_TREBLE_MID,
  ED_BASS_TOP, ED_BASS_MID, ED_BASS_BOT, ED_GRAND_THRESHOLD,
  ED_CLEF_X, ED_TS_X, ED_LEFT, ED_NOTE_SPACING, ED_BARLINE_GAP,
  DURATION_VALUE, beatValue, durationFits, computeMeasures,
  remainingInLastMeasure, fillWithRests, autoFillBeats, timeKey, beatTimeOffsets,
  TREBLE_SHARP_DPS, BASS_SHARP_DPS, TREBLE_FLAT_DPS, BASS_FLAT_DPS,
  KS_ACCIDENTAL_W, getKeySig, keySignatureAccidental, effectiveAccidental,
  displayAccidental, rewriteBeatsForKeySig,
  TONIC_OPTIONS, SCALE_OPTIONS,
} from "./musicTheory";
import { NoteIcon } from "./NoteIcon";
import { FormattedRn, FbEditInput, RnInput, RnLegend } from "./romanNumeral";

const C = Contrapunctus as ContrapunctusApi;

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


export function NoteEditor({ header, lessonConfig, onTrebleBeatsChanged, onBassBeatsChanged, figuredBassValues, onFiguredBassChanged, trebleOnly, initialTonicIdx, initialScaleName, initialTsTop, initialTsBottom, initialTrebleBeats, initialBassBeats, readOnly }: NoteEditorProps) {
  const embedded = !!(onTrebleBeatsChanged || onBassBeatsChanged);
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

  const saved = useRef(lessonConfig || onTrebleBeatsChanged || onBassBeatsChanged ? null : loadSaved());

  const [selectedDuration, setSelectedDuration] = useState<Duration>("quarter");
  const [selectedAccidental, setSelectedAccidental] = useState<Accidental>("");
  const [dottedMode, setDottedMode] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [restMode, setRestMode] = useState(false);
  const [tsTop, setTsTop] = useState(lessonConfig?.tsTop ?? initialTsTop ?? saved.current?.tsTop ?? 4);
  const [tsBottom, setTsBottom] = useState(lessonConfig?.tsBottom ?? initialTsBottom ?? saved.current?.tsBottom ?? 4);

  // Independent beat arrays for each staff
  const initRests = () => fillWithRests((lessonConfig?.tsTop ?? initialTsTop ?? 4) / (lessonConfig?.tsBottom ?? initialTsBottom ?? 4));
  const initTreble = (): PlacedBeat[] => {
    if (!lessonConfig) return initialTrebleBeats ?? saved.current?.trebleBeats ?? initRests();
    // Allow pre-populated beats (e.g. from a saved draft) to override defaults
    if (initialTrebleBeats) return initialTrebleBeats;
    // For figured bass lessons, lockedTrebleBeats is [] — init treble rests to match bass beat count
    if (lessonConfig.lockedTrebleBeats.length === 0 && lessonConfig.lockedBassBeats && lessonConfig.lockedBassBeats.length > 0) {
      return lessonConfig.lockedBassBeats.map(b => ({ notes: [], duration: b.duration, isRest: true }));
    }
    return lessonConfig.lockedTrebleBeats;
  };
  const [trebleBeats, setTrebleBeatsRaw] = useState<PlacedBeat[]>(initTreble);
  const [bassBeats, setBassBeatsRaw] = useState<PlacedBeat[]>(
    initialBassBeats ?? lessonConfig?.lockedBassBeats ?? saved.current?.bassBeats ?? initRests()
  );

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
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 700);
  const [isLandscape, setIsLandscape] = useState(() => typeof window !== "undefined" && window.innerWidth > window.innerHeight);
  const [isShortScreen, setIsShortScreen] = useState(() => typeof window !== "undefined" && window.innerHeight < 500);
  useEffect(() => {
    const mqMobile = window.matchMedia("(max-width: 700px)");
    const mqLandscape = window.matchMedia("(orientation: landscape)");
    const mqShort = window.matchMedia("(max-height: 500px)");
    const handleMobile = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const handleLandscape = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    const handleShort = (e: MediaQueryListEvent) => setIsShortScreen(e.matches);
    mqMobile.addEventListener("change", handleMobile);
    mqLandscape.addEventListener("change", handleLandscape);
    mqShort.addEventListener("change", handleShort);
    return () => {
      mqMobile.removeEventListener("change", handleMobile);
      mqLandscape.removeEventListener("change", handleLandscape);
      mqShort.removeEventListener("change", handleShort);
    };
  }, []);
  const [toolbarExpanded, setToolbarExpanded] = useState(() => typeof window !== "undefined" && window.innerWidth >= 700);

  // Auto-collapse toolbar when screen is short (landscape mobile)
  useEffect(() => {
    if (isShortScreen) setToolbarExpanded(false);
  }, [isShortScreen]);
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
    if (lessonConfig || onTrebleBeatsChanged || onBassBeatsChanged) return;
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
  // Per-staff note placement bounds (a few ledger lines beyond each staff)
  const TREBLE_MIN_DP = 24; // ~3 ledger lines below treble staff (C4)
  const BASS_MAX_DP = 32;   // ~3 ledger lines above bass staff (B4)
  const staffHeight = bassYOffset + (ED_BASS_TOP - displayBotDp) * STEP + STEP * 2;

  // Pad the shorter staff with whole-measure rests so both staves have equal measures.
  // If the last measure has notes, add an extra empty measure for easy continuation.
  const [paddedTrebleBeats, paddedBassBeats] = useMemo(() => {
    const measureCap = tsTop / tsBottom;
    const tMeasures = computeMeasures(trebleBeats, tsTop, tsBottom);
    const bMeasures = computeMeasures(bassBeats, tsTop, tsBottom);
    let maxM = Math.max(tMeasures.length, bMeasures.length);
    // Check if the last measure of either staff has a note
    const lastMeasureHasNote = (beats: PlacedBeat[], measures: { startIdx: number; count: number }[]): boolean => {
      if (measures.length === 0) return false;
      const last = measures[measures.length - 1];
      for (let i = last.startIdx; i < last.startIdx + last.count; i++) {
        if (!beats[i].isRest && beats[i].notes.length > 0) return true;
      }
      return false;
    };
    if (!lessonConfig && (lastMeasureHasNote(trebleBeats, tMeasures) || lastMeasureHasNote(bassBeats, bMeasures))) {
      maxM += 1;
    }
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
  }, [trebleBeats, bassBeats, tsTop, tsBottom, lessonConfig]);

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
  const [showErrorsRaw, setShowErrors] = useState(false);
  const showErrors = lessonConfig?.checked || showErrorsRaw;
  const maxFBFigures = lessonConfig?.figuredBass
    ? Math.max(0, ...lessonConfig.figuredBass.map(f => f?.length ?? 0))
    : 0;
  const FB_EXTRA = maxFBFigures > 1 ? maxFBFigures * 12 + 4 : maxFBFigures === 1 ? 20 : 0;
  const FB_EDIT_EXTRA = onFiguredBassChanged ? 32 : 0;
  const RN_SPACE = (showErrors ? 48 : 32) + FB_EXTRA + FB_EDIT_EXTRA;
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
  const [studentRomans, setStudentRomans] = useState<Record<number, string>>(lessonConfig?.initialStudentRomans ?? {});
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

  // Expose bass beats to external consumer (admin figured bass editor)
  useEffect(() => {
    if (onBassBeatsChanged) {
      onBassBeatsChanged(bassBeats);
    }
  }, [bassBeats, onBassBeatsChanged]);

  const [errorPanelOpen, setErrorPanelOpen] = useState(false);
  const [highlightedBeat, setHighlightedBeat] = useState<number | null>(null);

  const [rnSelections, setRnSelections] = useState<Record<number, number>>({});
  const [openRnDropdown, setOpenRnDropdown] = useState<number | null>(null);
  const [showNctRaw, setShowNct] = useState(false);
  const showNct = lessonConfig?.checked || showNctRaw;
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

  // Lazy-load Tone.js — only fetched when user first triggers playback
  const toneRef = useRef<typeof ToneNs | null>(null);
  async function getTone(): Promise<typeof ToneNs> {
    if (toneRef.current) return toneRef.current;
    const mod = await import("tone");
    toneRef.current = mod;
    return mod;
  }

  function getOrCreateSynth(Tone: typeof ToneNs): SynthLike {
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
    const Tone = await getTone();
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

    const s = getOrCreateSynth(Tone);

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
    const Tone = toneRef.current;
    if (!Tone) return;
    Tone.getTransport().pause();
    cancelAnimationFrame(rafRef.current);
    setIsPaused(true);
    setIsPlaying(false);
  }, []);

  const handleStop = useCallback(() => {
    const Tone = toneRef.current;
    if (Tone) {
      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel();
    }
    cancelAnimationFrame(rafRef.current);
    synthRef.current?.releaseAll();
    setIsPlaying(false);
    setIsPaused(false);
    setPlaybackTimeIdx(null);
    setPlaybackStartIdx(0);
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
      const Tone = toneRef.current;
      if (Tone) {
        Tone.getTransport().stop();
        Tone.getTransport().cancel();
      }
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

  // Keep a ref so touch handlers always call the latest xToBeatIdx (avoids stale closures)
  const xToBeatIdxRef = useRef(xToBeatIdx);
  xToBeatIdxRef.current = xToBeatIdx;

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

  /** Check if a dp is within the valid placement range for its staff. */
  const isValidStaffDp = useCallback((dp: number, staff: "treble" | "bass"): boolean => {
    if (dp < displayBotDp || dp > displayTopDp) return false;
    if (staff === "treble" && dp < TREBLE_MIN_DP) return false;
    if (staff === "bass" && dp > BASS_MAX_DP) return false;
    return true;
  }, []);

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
    if (isValidStaffDp(dp, staff)) {
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
    if (staff === "treble") {
      const locked = lessonConfig.lockedTrebleBeats[beatIdx];
      if (!locked) return false;
      return locked.notes.some((n) => n.dp === dp);
    }
    if (staff === "bass" && lessonConfig.lockedBassBeats) {
      const locked = lessonConfig.lockedBassBeats[beatIdx];
      if (!locked) return false;
      return locked.notes.some((n) => n.dp === dp);
    }
    return false;
  }, [lessonConfig]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly) return;
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

  /** Core click/tap handler. Accepts explicit position to avoid stale state from touch events. */
  const handleMouseUpWithPos = useCallback((overrideDp?: number, overrideStaff?: "treble" | "bass", overrideBeatIdx?: number) => {
    const curDp = overrideDp ?? hoverDp;
    const curStaff = overrideStaff ?? hoverStaff;
    const curBeatIdx = overrideBeatIdx ?? hoverBeatIdx;

    const drag = dragRef.current;
    dragRef.current = null;

    if (drag && drag.moved && curDp !== null && curStaff !== null) {
      // Drag only within the same staff
      if (curStaff === drag.staff) {
        const setter = setStaffBeats(drag.staff);
        setter((prev) => {
          if (drag.beatIdx >= prev.length) return prev;
          const beat = prev[drag.beatIdx];
          const origMatch = (n: PlacedNote) => n.dp === drag.note.dp;
          const withoutOrig = beat.notes.filter((n) => !origMatch(n));
          const destMatch = (n: PlacedNote) => n.dp === curDp;
          const filtered = withoutOrig.filter((n) => !destMatch(n));
          const movedNote: PlacedNote = { dp: curDp!, staff: curStaff!, accidental: drag.note.accidental };
          const newNotes = [...filtered, movedNote];
          const updated = [...prev];
          updated[drag.beatIdx] = { ...beat, notes: newNotes };
          return updated;
        });
      }
      return;
    }

    // No drag (or didn't move) — treat as regular click
    if (curDp === null || curBeatIdx === null || curStaff === null) return;

    const posMatch = (n: PlacedNote) => n.dp === curDp;
    const hoverNote: PlacedNote = { dp: curDp, staff: curStaff, accidental: selectedAccidental };
    const setter = setStaffBeats(curStaff);
    const beats = getStaffBeats(curStaff);

    if (restMode) {
      // In lesson mode, don't allow resting over locked beats
      if (lessonConfig && curStaff === "treble") return;
      if (lessonConfig && curStaff === "bass" && lessonConfig.lockedBassBeats) return;
      setter((prev) => {
        // If clicking a padded rest (beyond raw beats), expand prev to include the measure
        let working = prev;
        if (curBeatIdx >= prev.length) {
          const dBeats = curStaff === "treble" ? paddedTrebleBeats : paddedBassBeats;
          if (curBeatIdx < dBeats.length) {
            const measures = computeMeasures(dBeats, tsTop, tsBottom);
            const measure = measures.find((m) => curBeatIdx >= m.startIdx && curBeatIdx < m.startIdx + m.count);
            if (measure) {
              working = dBeats.slice(0, measure.startIdx + measure.count);
            } else {
              working = dBeats.slice(0, curBeatIdx + 1);
            }
          } else {
            return prev;
          }
        }
        if (curBeatIdx >= working.length) return prev;
        const beat = working[curBeatIdx];
        if (beat.isRest) {
          // Split the rest if a smaller duration is selected
          const selectedVal = DURATION_VALUE[selectedDuration] * (dottedMode ? 1.5 : 1);
          const restVal = beatValue(beat);
          if (selectedVal >= restVal - 1e-9) return prev; // same or larger — no-op
          // Find position in measure for correct rest alignment
          const measures = computeMeasures(working, tsTop, tsBottom);
          const measure = measures.find((m) => curBeatIdx >= m.startIdx && curBeatIdx < m.startIdx + m.count);
          let posInMeasure = 0;
          if (measure) {
            for (let i = measure.startIdx; i < curBeatIdx; i++) posInMeasure += beatValue(working[i]);
          }
          const newRest: PlacedBeat = { notes: [], duration: selectedDuration, isRest: true, dotted: dottedMode || undefined };
          const leftover = restVal - beatValue(newRest);
          const bUnit = 1 / tsBottom;
          const fillerRests = leftover > 1e-9 ? fillWithRests(leftover, posInMeasure + beatValue(newRest), bUnit) : [];
          return [
            ...working.slice(0, curBeatIdx),
            newRest,
            ...fillerRests,
            ...working.slice(curBeatIdx + 1),
          ];
        }
        const updated = [...working];
        updated[curBeatIdx] = { notes: [], duration: beat.duration, isRest: true };
        return updated;
      });
      return;
    }

    if (deleteMode) {
      // Don't delete locked notes
      if (isLockedNote(curStaff, curBeatIdx, curDp)) return;
      setter((prev) => {
        if (curBeatIdx >= prev.length) {
          // Beat is in the padded display area — check if it's a real trailing rest measure
          const measures = computeMeasures(prev, tsTop, tsBottom);
          if (measures.length <= 1) return prev;
          const last = measures[measures.length - 1];
          const allRests = prev.slice(last.startIdx, last.startIdx + last.count).every((b) => b.isRest);
          if (allRests) {
            // Trim the trailing all-rest measure
            const trimmed = prev.slice(0, last.startIdx);
            return trimmed.length > 0 ? trimmed : fillWithRests(tsTop / tsBottom);
          }
          return prev;
        }
        const beat = prev[curBeatIdx];
        if (beat.isRest) {
          // Check if this rest is in a trailing all-rest measure — if so, trim the whole measure
          const measures = computeMeasures(prev, tsTop, tsBottom);
          const measure = measures.find((m) => curBeatIdx >= m.startIdx && curBeatIdx < m.startIdx + m.count);
          if (measure) {
            const isLastMeasure = measure.startIdx + measure.count >= prev.length;
            const allRests = prev.slice(measure.startIdx, measure.startIdx + measure.count).every((b) => b.isRest);
            if (isLastMeasure && allRests && measures.length > 1) {
              const trimmed = prev.slice(0, measure.startIdx);
              return trimmed.length > 0 ? trimmed : fillWithRests(tsTop / tsBottom);
            }
          }
          // Otherwise remove just this rest beat
          const updated = prev.filter((_, i) => i !== curBeatIdx);
          return updated.length > 0 ? updated : fillWithRests(tsTop / tsBottom);
        }
        if (!beat.notes.some(posMatch)) return prev;
        const newNotes = beat.notes.filter((n) => !posMatch(n));
        if (newNotes.length === 0) {
          // In lesson mode, don't allow deleting all notes from a locked beat
          if (lessonConfig && curStaff === "treble") return prev;
          if (lessonConfig && curStaff === "bass" && lessonConfig.lockedBassBeats) return prev;
          const updated = [...prev];
          updated[curBeatIdx] = { notes: [], duration: beat.duration, isRest: true };
          return updated;
        }
        const updated = [...prev];
        updated[curBeatIdx] = { ...beat, notes: newNotes };
        return updated;
      });
      return;
    }

    setter((prev) => {
      // If clicking a padded rest (beyond raw beats), expand prev to include it
      let working = prev;
      if (curBeatIdx >= prev.length) {
        const dBeats = curStaff === "treble" ? paddedTrebleBeats : paddedBassBeats;
        if (curBeatIdx < dBeats.length) {
          working = dBeats.slice(0, curBeatIdx + 1);
          // Ensure we include at least through the measure containing curBeatIdx
          const measureCap = tsTop / tsBottom;
          const measures = computeMeasures(dBeats, tsTop, tsBottom);
          const measure = measures.find((m) => curBeatIdx >= m.startIdx && curBeatIdx < m.startIdx + m.count);
          if (measure) {
            working = dBeats.slice(0, measure.startIdx + measure.count);
          }
        }
      }
      if (curBeatIdx < working.length) {
        const beat = working[curBeatIdx];
        if (beat.isRest) {
          const measures = computeMeasures(working, tsTop, tsBottom);
          const measure = measures.find((m) => curBeatIdx >= m.startIdx && curBeatIdx < m.startIdx + m.count);
          if (!measure) return prev;
          const restStart = curBeatIdx;
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
        // In lesson mode, don't allow duration changes on locked staves
        if (lessonConfig && curStaff === "treble" && beat.duration !== selectedDuration) return prev;
        if (lessonConfig && curStaff === "bass" && lessonConfig.lockedBassBeats && beat.duration !== selectedDuration) return prev;
        // Different duration selected → replace beat with new note at selected duration
        if (beat.duration !== selectedDuration) {
          // Treat like clicking on the rest space: remove this beat and consecutive rests after it,
          // then insert the new note and fill remaining space
          const measures = computeMeasures(working, tsTop, tsBottom);
          const measure = measures.find((m) => curBeatIdx >= m.startIdx && curBeatIdx < m.startIdx + m.count);
          if (!measure) return prev;
          const measureEnd = measure.startIdx + measure.count;
          // Free space from this beat onward (this beat + any consecutive rests after it)
          let beatsToRemove = 1;
          let spaceFreed = beatValue(beat);
          for (let i = curBeatIdx + 1; i < measureEnd && working[i].isRest; i++) {
            beatsToRemove++;
            spaceFreed += beatValue(working[i]);
          }
          if (!durationFits(selectedDuration, spaceFreed, dottedMode)) return prev;
          const newBeat: PlacedBeat = { notes: [...beat.notes], duration: selectedDuration, dotted: dottedMode || undefined };
          const leftover = spaceFreed - beatValue(newBeat);
          let posInMeasure = 0;
          for (let i = measure.startIdx; i < curBeatIdx; i++) posInMeasure += beatValue(working[i]);
          posInMeasure += beatValue(newBeat);
          const bUnit = 1 / tsBottom;
          const fillerRests = leftover > 1e-9 ? fillWithRests(leftover, posInMeasure, bUnit) : [];
          return [
            ...working.slice(0, curBeatIdx),
            newBeat,
            ...fillerRests,
            ...working.slice(curBeatIdx + beatsToRemove),
          ];
        }
        // Same duration — toggle/add notes within the beat
        const existing = beat.notes.find(posMatch);
        if (existing) {
          // Don't allow toggling off or changing locked soprano notes
          if (isLockedNote(curStaff, curBeatIdx, curDp)) return prev;
          if (existing.accidental === selectedAccidental) {
            // Toggle off this note
            const newNotes = beat.notes.filter((n) => !posMatch(n));
            if (newNotes.length === 0) {
              const updated = [...working];
              updated[curBeatIdx] = { notes: [], duration: beat.duration, isRest: true };
              return updated;
            }
            const updated = [...working];
            updated[curBeatIdx] = { ...beat, notes: newNotes };
            return updated;
          }
          // Change accidental on existing note
          const updated = [...working];
          updated[curBeatIdx] = { ...beat, notes: beat.notes.map((n) => posMatch(n) ? hoverNote : n) };
          return updated;
        }
        // Add note to chord
        const updated = [...working];
        updated[curBeatIdx] = { ...beat, notes: [...beat.notes, hoverNote] };
        return updated;
      }
      // Past the end — start a new measure
      return [...working, { notes: [hoverNote], duration: selectedDuration, dotted: dottedMode || undefined }];
    });
  }, [hoverDp, hoverStaff, hoverBeatIdx, selectedDuration, selectedAccidental, dottedMode, deleteMode, restMode, tsTop, tsBottom, trebleBeats, bassBeats, paddedTrebleBeats, paddedBassBeats, isLockedNote, lessonConfig, readOnly]);

  /** No-arg wrapper for mouse events (uses current hover state from closure). */
  const handleMouseUp = useCallback(() => handleMouseUpWithPos(), [handleMouseUpWithPos]);

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
      if (readOnly) return;

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

  // ── Touch event handlers for mobile ─────────────────────────────────
  const svgCoordsFromClient = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scaleY = svgHeight / rect.height;
    const scaleX = staffW / rect.width;
    const mouseY = (clientY - rect.top) * scaleY;
    const mouseX = (clientX - rect.left) * scaleX;
    const sysIdx = Math.min(Math.floor(mouseY / systemTotalHeight), systemCount - 1);
    const localY = mouseY - sysIdx * systemTotalHeight;
    return { mouseX, mouseY, sysIdx, localY };
  }, [svgHeight, staffW, systemTotalHeight, systemCount]);

  const updateHoverFromTouch = useCallback((clientX: number, clientY: number) => {
    const coords = svgCoordsFromClient(clientX, clientY);
    if (!coords) return;
    const { mouseX, sysIdx, localY } = coords;
    const { dp, staff } = yToDpAndStaff(localY);
    if (isValidStaffDp(dp, staff)) {
      setHoverDp(dp);
      setHoverStaff(staff);
      setHoverBeatIdx(xToBeatIdxRef.current(mouseX, staff, sysIdx));
    } else {
      setHoverDp(null);
      setHoverStaff(null);
      setHoverBeatIdx(null);
    }
  }, [svgCoordsFromClient, yToDpAndStaff, isValidStaffDp]);

  /** Check if a touch point is on a valid staff position (not in the dead zone). */
  const isTouchOnStaff = useCallback((clientX: number, clientY: number): boolean => {
    const coords = svgCoordsFromClient(clientX, clientY);
    if (!coords) return false;
    const { dp, staff } = yToDpAndStaff(coords.localY);
    return isValidStaffDp(dp, staff);
  }, [svgCoordsFromClient, yToDpAndStaff, isValidStaffDp]);

  const touchActiveRef = useRef(false);
  const touchHoverRef = useRef<{ dp: number; staff: "treble" | "bass"; beatIdx: number } | null>(null);

  const handleTouchStartNative = useCallback((e: TouchEvent) => {
    if (readOnly) return;
    const touch = e.touches[0];
    if (!isTouchOnStaff(touch.clientX, touch.clientY)) {
      touchActiveRef.current = false;
      return; // allow scrolling in dead zone
    }
    e.preventDefault();
    touchActiveRef.current = true;
    // Compute and store hover synchronously
    const coords = svgCoordsFromClient(touch.clientX, touch.clientY);
    if (coords) {
      const { mouseX, sysIdx, localY } = coords;
      const { dp, staff } = yToDpAndStaff(localY);
      if (isValidStaffDp(dp, staff)) {
        const beatIdx = xToBeatIdxRef.current(mouseX, staff, sysIdx);
        touchHoverRef.current = { dp, staff, beatIdx };
        setHoverDp(dp);
        setHoverStaff(staff);
        setHoverBeatIdx(beatIdx);
      }
    }
  }, [readOnly, isTouchOnStaff, svgCoordsFromClient, yToDpAndStaff, isValidStaffDp]);

  const handleTouchMoveNative = useCallback((e: TouchEvent) => {
    if (readOnly || !touchActiveRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const coords = svgCoordsFromClient(touch.clientX, touch.clientY);
    if (coords) {
      const { mouseX, sysIdx, localY } = coords;
      const { dp, staff } = yToDpAndStaff(localY);
      if (isValidStaffDp(dp, staff)) {
        const beatIdx = xToBeatIdxRef.current(mouseX, staff, sysIdx);
        touchHoverRef.current = { dp, staff, beatIdx };
        setHoverDp(dp);
        setHoverStaff(staff);
        setHoverBeatIdx(beatIdx);
      } else {
        touchHoverRef.current = null;
        setHoverDp(null);
        setHoverStaff(null);
        setHoverBeatIdx(null);
      }
    }
  }, [readOnly, svgCoordsFromClient, yToDpAndStaff, isValidStaffDp]);

  const handleTouchEndNative = useCallback((e: TouchEvent) => {
    if (readOnly || !touchActiveRef.current) return;
    e.preventDefault();
    touchActiveRef.current = false;
    const hover = touchHoverRef.current;
    if (hover) {
      // Call handleMouseUp with the touch position injected via refs,
      // bypassing stale React state by temporarily overriding it
      handleMouseUpWithPos(hover.dp, hover.staff, hover.beatIdx);
    }
    setTimeout(() => {
      setHoverDp(null);
      setHoverStaff(null);
      setHoverBeatIdx(null);
      touchHoverRef.current = null;
    }, 100);
  }, [readOnly, handleMouseUpWithPos]);

  // Attach touch listeners imperatively with { passive: false } so preventDefault works
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener("touchstart", handleTouchStartNative, { passive: false });
    svg.addEventListener("touchmove", handleTouchMoveNative, { passive: false });
    svg.addEventListener("touchend", handleTouchEndNative, { passive: false });
    return () => {
      svg.removeEventListener("touchstart", handleTouchStartNative);
      svg.removeEventListener("touchmove", handleTouchMoveNative);
      svg.removeEventListener("touchend", handleTouchEndNative);
    };
  }, [handleTouchStartNative, handleTouchMoveNative, handleTouchEndNative]);

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
    width: isMobile ? 40 : 34, height: isMobile ? 40 : 34,
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
        @media (max-width: 700px) {
          .cp-toolbar { padding: 0 8px !important; }
          .cp-toolbar .cp-group-label { display: none; }
        }
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
        {/* Title bar — hidden in embedded mode and when screen is short (landscape mobile) */}
        {!embedded && !isShortScreen && <div style={{
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
        {!readOnly && !toolbarExpanded && (
        <div style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "6px 0",
          gap: (isMobile || isShortScreen) ? 4 : 8,
        }}>
          {/* Expand toggle — always visible first on mobile/landscape */}
          {(isMobile || isShortScreen) && (
            <button
              onClick={() => setToolbarExpanded(true)}
              style={{ ...btnBase, width: 32, height: 32, color: "#888", flexShrink: 0 }}
              title="Expand toolbar"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 5.5 L7 9.5 L11 5.5" />
              </svg>
            </button>
          )}

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

          {/* Zoom — visible on mobile/landscape in collapsed toolbar */}
          {(isMobile || isShortScreen) && (
            <div style={groupStyle}>
              <button onClick={() => { const z = Math.max(0.5, +(zoom - 0.1).toFixed(1)); setZoom(z); localStorage.setItem("contrapunctus_zoom", String(z)); }}
                style={{ ...btnBase, width: 28, height: 28 }} title="Zoom out">−</button>
              <span style={{ fontSize: 12, color: theme.textMuted, minWidth: 32, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => { const z = Math.min(2, +(zoom + 0.1).toFixed(1)); setZoom(z); localStorage.setItem("contrapunctus_zoom", String(z)); }}
                style={{ ...btnBase, width: 28, height: 28 }} title="Zoom in">+</button>
            </div>
          )}

          {/* Note indicator — pushed right on mobile/landscape */}
          {(isMobile || isShortScreen) && (
            <span style={{ marginLeft: "auto", color: theme.textMuted, fontSize: 18, fontFamily: "serif", minWidth: 36, textAlign: "right", flexShrink: 0 }}>
              {hoverDp !== null ? (() => {
                const letterIdx = ((hoverDp % 7) + 7) % 7;
                const octave = Math.floor(hoverDp / 7);
                const acc = accidentalSymbol(effectiveAccidental(selectedAccidental, hoverDp, keySig));
                return `${LETTERS[letterIdx]}${acc}${octave}`;
              })() : "\u00A0"}
            </span>
          )}

          {/* Note indicator + expand toggle — pushed right (desktop only) */}
          {!isMobile && !isShortScreen && (
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
          )}
        </div>
        )}

        {/* Expanded: full two-row toolbar */}
        {!readOnly && toolbarExpanded && (<>
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
            <span className="cp-group-label" style={groupLabel}>Note</span>
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
            <span className="cp-group-label" style={groupLabel}>Acc</span>
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
            <span className="cp-group-label" style={groupLabel}>Edit</span>
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
            <span className="cp-group-label" style={groupLabel}>Analysis</span>
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
            <span className="cp-group-label" style={groupLabel}>Play</span>
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
            <span className="cp-group-label" style={groupLabel}>Time</span>
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
            <span className="cp-group-label" style={groupLabel}>Key</span>
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
            <span className="cp-group-label" style={groupLabel}>Zoom</span>
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
        flexDirection: isMobile ? "column" : "row",
        justifyContent: "center",
        gap: 16,
        padding: isShortScreen ? "4px 4px" : isMobile ? "12px 4px" : "24px 16px",
        paddingBottom: header ? (isMobile ? 100 : 80) : undefined,
        alignItems: "flex-start",
      }}>

      {/* Page card */}
      <div style={{
        maxWidth: 960,
        width: "100%",
        minWidth: (isMobile || isShortScreen) ? undefined : 960,
        flex: showErrors && errorPanelOpen ? "1 1 0" : undefined,
        padding: isShortScreen ? "8px 8px 12px" : isMobile ? "16px 8px 24px" : "36px 40px 48px",
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
                    // Don't render rest symbols for padded (virtual) beats
                    if (i >= trebleBeats.length) return null;
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
                    // Don't render rest symbols for padded (virtual) beats
                    if (i >= bassBeats.length) return null;
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

              {/* Roman numerals + chord errors (shown in normal mode and lesson checked mode) */}
              {(!lessonConfig || lessonConfig.checked) && allTimePoints.map((t, i) => {
                const useStudentRn = lessonConfig?.showStudentRomans && lessonConfig.checked;
                const studentVal = useStudentRn ? (studentRomans[i] ?? "").trim() : "";
                const rns = useStudentRn ? (studentVal ? [studentVal] : []) : activeLabels[i];
                const hasRn = useStudentRn ? studentVal.length > 0 : (hasRN && rns && rns.length > 0);
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

              {/* Figured bass labels (displayed above RN input area) */}
              {lessonConfig?.figuredBass && !lessonConfig.checked && allTimePoints.map((t, i) => {
                const figures = lessonConfig.figuredBass![i];
                if (!figures || figures.length === 0) return null;
                const pos = timeToPos.get(t);
                if (!pos || pos.systemIdx !== sysIdx) return null;
                const rx = pos.x;
                const fbY = staffHeight + 2;
                return (
                  <g key={`fb-${i}`}>
                    {figures.length === 1 ? (
                      <text x={rx} y={fbY + 14} fontSize={14}
                        fontFamily="serif" fontStyle="italic" textAnchor="middle"
                        fill={dk ? "#c8b8a0" : "#8b7355"}>
                        {figures[0]}
                      </text>
                    ) : (
                      figures.map((f, fi) => (
                        <text key={fi} x={rx} y={fbY + 10 + fi * 12} fontSize={12}
                          fontFamily="serif" fontStyle="italic" textAnchor="middle"
                          fill={dk ? "#c8b8a0" : "#8b7355"}>
                          {f}
                        </text>
                      ))
                    )}
                  </g>
                );
              })}

              {/* Admin figured bass editing: input fields below each bass note */}
              {onFiguredBassChanged && figuredBassValues && bassTimes.map((t, i) => {
                const beat = bassBeats[i];
                if (!beat || beat.isRest || beat.notes.length === 0) return null;
                const pos = bassBeatPositions[i];
                if (!pos || pos.sys !== sysIdx) return null;
                const inputW = 48;
                const inputH = 24;
                const fbY = staffHeight + 4;
                return (
                  <foreignObject key={`fb-edit-${i}`} x={pos.x - inputW / 2} y={fbY} width={inputW} height={inputH}>
                    <FbEditInput
                      value={figuredBassValues[i] ?? []}
                      onChange={(figures) => {
                        const next = [...figuredBassValues];
                        while (next.length <= i) next.push([]);
                        next[i] = figures;
                        onFiguredBassChanged(next);
                      }}
                      dark={dk}
                    />
                  </foreignObject>
                );
              })}

              {/* Lesson mode: student RN input fields (hidden when checked — computed labels shown instead) */}
              {lessonConfig && !lessonConfig.checked && allTimePoints.map((t, i) => {
                const pos = timeToPos.get(t);
                if (!pos || pos.systemIdx !== sysIdx) return null;
                const rx = pos.x;
                const rnY = staffHeight + 4 + FB_EXTRA;
                const inputW = 56;
                const inputH = 30;
                return (
                  <foreignObject key={`rn-input-${i}`} x={rx - inputW / 2} y={rnY} width={inputW} height={inputH}>
                    <RnInput
                      value={studentRomans[i] ?? ""}
                      onChange={(v) => setStudentRomans((prev) => ({ ...prev, [i]: v }))}
                      dark={dk}
                      disabled={readOnly}
                    />
                  </foreignObject>
                );
              })}

              {/* Clickable areas to set playback start position — covers RN area + gap below bass staff */}
              {!isPlaying && !isPaused && !onFiguredBassChanged && allTimePoints.map((t, i) => {
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
          width: isMobile ? "100%" : 300,
          minWidth: isMobile ? undefined : 300,
          maxHeight: isMobile ? "50vh" : "calc(100vh - 120px)",
          position: isMobile ? "relative" : "sticky",
          top: isMobile ? undefined : 80,
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
        position: isShortScreen ? "relative" : "fixed", bottom: isShortScreen ? undefined : 0,
        left: isShortScreen ? undefined : 0, right: isShortScreen ? undefined : 0, zIndex: 100,
        background: dk ? "#222228" : "#f0ede9", borderTop: `1px solid ${theme.footerBorder}`, color: theme.text,
      }}>
        {lessonConfig && !lessonConfig.checked && <RnLegend dark={dk} />}
        <div style={{ padding: lessonConfig ? "0 24px" : "16px 24px" }}>{header}</div>
      </div>}
    </div>
  );
}

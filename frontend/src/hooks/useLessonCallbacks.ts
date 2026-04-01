import { useState, useCallback } from "react";
import type { PlacedBeat, LessonErrorItem } from "../components/staff/types";

export function useLessonCallbacks() {
  const [partWritingErrors, setPartWritingErrors] = useState<LessonErrorItem[]>([]);
  const [computedRomans, setComputedRomans] = useState<string[][]>([]);
  const [studentRomans, setStudentRomans] = useState<Record<number, string>>({});
  const [trebleBeats, setTrebleBeats] = useState<PlacedBeat[]>([]);
  const [bassBeats, setBassBeats] = useState<PlacedBeat[]>([]);

  const onErrorsComputed = useCallback((errs: LessonErrorItem[]) => {
    setPartWritingErrors(errs);
  }, []);

  const onRomansComputed = useCallback((romans: string[][]) => {
    setComputedRomans(romans);
  }, []);

  const onStudentRomansChanged = useCallback((sr: Record<number, string>) => {
    setStudentRomans(sr);
  }, []);

  const onBeatsChanged = useCallback((treble: PlacedBeat[], bass: PlacedBeat[]) => {
    setTrebleBeats(treble);
    setBassBeats(bass);
  }, []);

  return {
    partWritingErrors,
    computedRomans,
    studentRomans,
    trebleBeats,
    bassBeats,
    onErrorsComputed,
    onRomansComputed,
    onStudentRomansChanged,
    onBeatsChanged,
  };
}

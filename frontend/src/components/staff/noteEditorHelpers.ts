import type { PlacedBeat, PlacedNote } from "./types";
import { beatValue } from "./musicTheory";

/** Check if the last measure of a staff contains any non-rest beats with notes. */
export function lastMeasureHasNote(
  beats: PlacedBeat[],
  measures: { startIdx: number; count: number }[],
): boolean {
  if (measures.length === 0) return false;
  const last = measures[measures.length - 1];
  for (let i = last.startIdx; i < last.startIdx + last.count; i++) {
    if (!beats[i].isRest && beats[i].notes.length > 0) return true;
  }
  return false;
}

/** Pad a staff's beats with whole-measure rests up to a target measure count. */
export function padToMeasures(
  beats: PlacedBeat[],
  mCount: number,
  maxM: number,
  fillWithRests: (cap: number) => PlacedBeat[],
  measureCap: number,
): PlacedBeat[] {
  if (mCount >= maxM) return beats;
  const padding: PlacedBeat[] = [];
  for (let i = mCount; i < maxM; i++) {
    padding.push(...fillWithRests(measureCap));
  }
  return [...beats, ...padding];
}

/** Find which notes are sounding at time t from a staff's beats. */
export function soundingNotes(
  beats: PlacedBeat[],
  times: number[],
  t: number,
): PlacedNote[] {
  let idx = -1;
  for (let i = 0; i < times.length; i++) {
    if (times[i] <= t + 1e-9) idx = i;
    else break;
  }
  if (idx < 0) return [];
  const beat = beats[idx];
  if (beat.isRest) return [];
  const beatEnd = times[idx] + beatValue(beat);
  if (beatEnd > t - 1e-9) return beat.notes;
  return [];
}

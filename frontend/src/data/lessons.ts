import type { PlacedBeat } from "../components/Staff";
import { API_BASE } from "../auth";

export interface Lesson {
  id: string;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  template: string;
  /** Index into TONIC_OPTIONS (0 = C). */
  tonicIdx: number;
  scaleName: string;
  tsTop: number;
  tsBottom: number;
  /** Pre-filled soprano melody on the treble staff. */
  sopranoBeats: PlacedBeat[];
  sortOrder: number;
}

export async function fetchLessons(): Promise<Lesson[]> {
  const res = await fetch(`${API_BASE}/api/lessons`);
  if (!res.ok) throw new Error("Failed to fetch lessons");
  return res.json();
}

export async function fetchLesson(id: string): Promise<Lesson | null> {
  const res = await fetch(`${API_BASE}/api/lessons/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch lesson");
  return res.json();
}

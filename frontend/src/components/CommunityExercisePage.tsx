import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth, API_BASE } from "../auth";
import { NoteEditor } from "./staff";
import type { LessonConfig } from "./staff/types";

interface CommunityExercise {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  template: string;
  tonicIdx: number;
  scaleName: string;
  tsTop: number;
  tsBottom: number;
  sopranoBeats: any;
  bassBeats: any | null;
  figuredBass: any | null;
  referenceSolution: any | null;
  rnAnswerKey: any | null;
  tags: string[];
  status: string;
  attemptCount: number;
  completionCount: number;
  completionRate: number;
  inferredDifficulty: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  updatedAt: string;
}

interface ExerciseAttempt {
  id: string;
  userId: string;
  exerciseId: string;
  trebleBeats: any;
  bassBeats: any;
  studentRomans: any;
  score: number | null;
  completed: boolean;
  status: string;
  savedAt: string;
  submittedAt: string | null;
}

const TEMPLATE_LABELS: Record<string, string> = {
  harmonize_melody: "Harmonize Melody",
  rn_analysis: "Roman Numeral Analysis",
};
const NOTE_NAMES = ["C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B", "Cb", "B#"];
const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "#16a34a",
  intermediate: "#d97706",
  advanced: "#dc2626",
  unknown: "#888",
};

export function CommunityExercisePage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, logout } = useAuth();
  const [darkMode] = useState(() => {
    try { return localStorage.getItem("contrapunctus_dark") === "true"; } catch { return false; }
  });
  const dk = darkMode;

  const [exercise, setExercise] = useState<CommunityExercise | null>(null);
  const [attempt, setAttempt] = useState<ExerciseAttempt | null>(null);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<any>(null);
  const [studentRomans, setStudentRomans] = useState<any>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const theme = {
    bg: dk ? "#1e1e22" : "#e8e4e0",
    cardBg: dk ? "#2a2a30" : "#fff",
    cardBorder: dk ? "#3a3a40" : "#e0dcd8",
    cardShadow: dk ? "0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)",
    text: dk ? "#e0ddd8" : "#1a1a1a",
    textSub: dk ? "#aaa" : "#555",
    textMuted: dk ? "#888" : "#888",
    accent: dk ? "#7c9cff" : "#4a6fff",
    footerBg: dk ? "#222228" : "#f0ede9",
    footerBorder: dk ? "#3a3a40" : "#e0dcd8",
  };

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/community/exercises/${id}`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/community/exercises/${id}/attempt`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/community/exercises/${id}/vote`, { headers }).then(r => r.ok ? r.json() : null),
    ]).then(([ex, att, vote]) => {
      setExercise(ex);
      setAttempt(att);
      setUserVote(vote?.vote || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token, id]);

  const isOwnExercise = exercise?.creatorId === user?.id;
  const isSubmitted = attempt?.status === "submitted";

  const handleVote = async (vote: string) => {
    const res = await fetch(`${API_BASE}/api/community/exercises/${id}/vote`, {
      method: "POST",
      headers,
      body: JSON.stringify({ vote }),
    });
    if (res.ok) {
      // Toggle behavior: if same vote, it removes it
      if (userVote === vote) {
        setUserVote(null);
        setExercise(prev => prev ? {
          ...prev,
          upvotes: vote === "up" ? prev.upvotes - 1 : prev.upvotes,
          downvotes: vote === "down" ? prev.downvotes - 1 : prev.downvotes,
        } : prev);
      } else {
        const prevVote = userVote;
        setUserVote(vote);
        setExercise(prev => prev ? {
          ...prev,
          upvotes: (vote === "up" ? prev.upvotes + 1 : prev.upvotes) - (prevVote === "up" ? 1 : 0),
          downvotes: (vote === "down" ? prev.downvotes + 1 : prev.downvotes) - (prevVote === "down" ? 1 : 0),
        } : prev);
      }
    }
  };

  // Track latest beats from editor for saving
  const [latestBeats, setLatestBeats] = useState<{ treble: any; bass: any } | null>(null);

  const handleBeatsChanged = useCallback((treble: any, bass: any) => {
    setLatestBeats({ treble, bass });
  }, []);

  const handleErrorsComputed = useCallback((errs: any) => {
    setErrors(errs);
  }, []);

  const handleRomansComputed = useCallback((_romans: any) => {
    // no-op for harmonize_melody
  }, []);

  const handleStudentRomansChanged = useCallback((romans: any) => {
    setStudentRomans(romans);
  }, []);

  const handleSave = async () => {
    if (!latestBeats || !id) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/community/exercises/${id}/attempt`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          trebleBeats: latestBeats.treble || [],
          bassBeats: latestBeats.bass || [],
          studentRomans: studentRomans || [],
        }),
      });
      if (res.ok) {
        const att = await res.json();
        setAttempt(att);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCheck = () => {
    setChecked(true);
  };

  const handleSubmit = async () => {
    if (!id) return;
    // Save first
    await handleSave();
    setSubmitting(true);
    try {
      // Calculate score from errors
      const computedScore = errors ? Math.max(0, 100 - (errors.length || 0) * 5) : 100;
      const completed = computedScore >= 70;
      const res = await fetch(`${API_BASE}/api/community/exercises/${id}/submit`, {
        method: "POST",
        headers,
        body: JSON.stringify({ score: computedScore, completed }),
      });
      if (res.ok) {
        const att = await res.json();
        setAttempt(att);
        setScore(computedScore);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const lessonConfig: LessonConfig | null = useMemo(() => {
    if (!exercise) return null;
    return {
      lockedTrebleBeats: exercise.template === "harmonize_melody" ? exercise.sopranoBeats : [],
      lockedBassBeats: exercise.bassBeats || undefined,
      figuredBass: exercise.figuredBass || undefined,
      tonicIdx: exercise.tonicIdx,
      scaleName: exercise.scaleName,
      tsTop: exercise.tsTop,
      tsBottom: exercise.tsBottom,
      onErrorsComputed: handleErrorsComputed,
      onRomansComputed: handleRomansComputed,
      onStudentRomansChanged: handleStudentRomansChanged,
      onBeatsChanged: handleBeatsChanged,
      checked,
    };
  }, [exercise, handleErrorsComputed, handleRomansComputed, handleStudentRomansChanged, handleBeatsChanged, checked]);

  const btnStyle: React.CSSProperties = {
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 600,
    background: theme.accent,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading...
      </div>
    );
  }

  if (!exercise || !lessonConfig) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Exercise not found</div>
        <Link to="/community" style={{ color: theme.accent }}>Back to community</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NoteEditor
        lessonConfig={lessonConfig}
        readOnly={isSubmitted}
        header={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link to="/community" style={{ fontSize: 13, color: theme.textMuted, textDecoration: "none" }}>
                &larr;
              </Link>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{exercise.title}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {isSubmitted && attempt && (
                <span style={{ fontSize: 12, fontWeight: 600, color: attempt.completed ? "#16a34a" : "#d97706", marginRight: 4 }}>
                  {attempt.completed ? "Completed" : "Submitted"}{attempt.score !== null && ` ${attempt.score}%`}
                </span>
              )}
              {isOwnExercise && (
                <span style={{ fontSize: 12, color: theme.textSub, marginRight: 4 }}>Your exercise</span>
              )}
              {!isSubmitted && !isOwnExercise && (
                <>
                  <button onClick={handleSave} disabled={saving} style={{
                    ...btnStyle, padding: "4px 12px", fontSize: 12,
                    background: "transparent", color: theme.accent,
                    border: `1px solid ${theme.accent}`,
                    opacity: saving ? 0.6 : 1,
                  }}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button onClick={handleCheck} style={{
                    ...btnStyle, padding: "4px 12px", fontSize: 12,
                    background: "transparent", color: "#d97706",
                    border: "1px solid #d97706",
                  }}>
                    Check
                  </button>
                  <button onClick={handleSubmit} disabled={submitting} style={{
                    ...btnStyle, padding: "4px 12px", fontSize: 12,
                    opacity: submitting ? 0.6 : 1,
                  }}>
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                </>
              )}
            </div>
          </div>
        }
      />
    </div>
  );
}

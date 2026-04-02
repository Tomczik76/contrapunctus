import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth, API_BASE } from "../auth";
import { NoteEditor } from "./staff";
import type { LessonConfig, LessonErrorItem } from "./staff/types";
import { useTheme } from "../useTheme";
import { TEMPLATE_LABELS, DIFFICULTY_COLORS, NOTE_NAMES } from "../constants";

interface CommunityExercise {
  id: string;
  creatorId: string;
  creatorDisplayName: string;
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

export function CommunityExercisePage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, logout } = useAuth();
  const theme = useTheme();
  const dk = theme.dk;

  const [exercise, setExercise] = useState<CommunityExercise | null>(null);
  const [attempt, setAttempt] = useState<ExerciseAttempt | null>(null);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<LessonErrorItem[] | null>(null);
  const [studentRomans, setStudentRomans] = useState<any>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    const safeFetch = (url: string) =>
      fetch(url, { headers }).then(r => r.ok ? r.json() : null).catch(() => null);
    Promise.all([
      safeFetch(`${API_BASE}/api/community/exercises/${id}`),
      safeFetch(`${API_BASE}/api/community/exercises/${id}/attempt`),
      safeFetch(`${API_BASE}/api/community/exercises/${id}/vote`),
    ]).then(([ex, att, vote]) => {
      setExercise(ex);
      setAttempt(att);
      setUserVote(vote?.vote || null);
      setLoading(false);
    });
  }, [token, id]);

  const isOwnExercise = exercise?.creatorId === user?.id;
  const isSubmitted = attempt?.status === "submitted";
  const [revising, setRevising] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(true);

  // Auto-enable checking when viewing a submitted exercise so errors are computed
  useEffect(() => {
    if (isSubmitted && !revising) {
      setChecked(true);
    }
  }, [isSubmitted, revising]);

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

  const handleErrorsComputed = useCallback((errs: LessonErrorItem[]) => {
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
      // Score is computed server-side for all templates
      const res = await fetch(`${API_BASE}/api/community/exercises/${id}/submit`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const att = await res.json();
        setAttempt(att);
        setScore(att.score ?? null);
        setRevising(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const lessonConfig: LessonConfig | null = useMemo(() => {
    if (!exercise) return null;

    if (exercise.template === "species_counterpoint") {
      // Detect CF voice: if sopranoBeats populated and bassBeats empty/null → CF is soprano
      const cfIsSoprano = exercise.sopranoBeats && exercise.sopranoBeats.length > 0
        && (!exercise.bassBeats || exercise.bassBeats.length === 0);
      return {
        lockedTrebleBeats: cfIsSoprano ? exercise.sopranoBeats : [],
        lockedBassBeats: cfIsSoprano ? undefined : (exercise.bassBeats || undefined),
        tonicIdx: exercise.tonicIdx,
        scaleName: "none",
        tsTop: exercise.tsTop,
        tsBottom: exercise.tsBottom,
        onErrorsComputed: handleErrorsComputed,
        onBeatsChanged: handleBeatsChanged,
        checked,
        forceDuration: "whole" as const,
        template: "species_counterpoint",
      };
    }

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
        key={attempt?.id ?? "no-attempt"}
        lessonConfig={lessonConfig}
        readOnly={isSubmitted && !revising}
        initialTrebleBeats={attempt?.trebleBeats || undefined}
        initialBassBeats={attempt?.bassBeats || undefined}
        subheader={exercise.description ? (
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "12px 24px 0", fontSize: 14, color: theme.textSub, lineHeight: 1.5 }}>
            {exercise.description}
          </div>
        ) : undefined}
        header={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link to="/community" style={{ fontSize: 13, color: theme.textMuted, textDecoration: "none" }}>
                &larr;
              </Link>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{exercise.title}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {!isOwnExercise && (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  border: `1px solid ${theme.cardBorder}`, borderRadius: 8,
                  padding: "2px 4px", minWidth: 32,
                }}>
                  <button
                    onClick={() => handleVote("up")}
                    style={{
                      padding: 0, fontSize: 11, lineHeight: 1, background: "none", border: "none",
                      cursor: "pointer",
                      color: userVote === "up" ? "#16a34a" : theme.textMuted,
                    }}
                    title="Upvote"
                  >&#9650;</button>
                  <span style={{
                    fontSize: 12, fontWeight: 700, lineHeight: 1.2,
                    color: userVote === "up" ? "#16a34a" : userVote === "down" ? "#d97706" : "inherit",
                  }}>
                    {(exercise.upvotes || 0) - (exercise.downvotes || 0)}
                  </span>
                  <button
                    onClick={() => handleVote("down")}
                    style={{
                      padding: 0, fontSize: 11, lineHeight: 1, background: "none", border: "none",
                      cursor: "pointer",
                      color: userVote === "down" ? "#d97706" : theme.textMuted,
                    }}
                    title="Downvote"
                  >&#9660;</button>
                </div>
              )}
              {isSubmitted && !revising && attempt && (
                <>
                  <span style={{ fontSize: 12, fontWeight: 600, color: attempt.completed ? "#16a34a" : "#d97706" }}>
                    {attempt.completed ? "Completed" : "Submitted"}{attempt.score !== null && ` ${attempt.score}%`}
                  </span>
                  {!isOwnExercise && (
                    <button onClick={() => setRevising(true)} style={{
                      ...btnStyle, padding: "4px 12px", fontSize: 12,
                      background: "transparent", color: theme.accent,
                      border: `1px solid ${theme.accent}`,
                    }}>
                      Revise
                    </button>
                  )}
                </>
              )}
              {isOwnExercise && (
                <span style={{ fontSize: 12, color: theme.textSub }}>Your exercise</span>
              )}
              {(!isSubmitted || revising) && !isOwnExercise && (
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
                    {submitting ? "Resubmit" : "Submit"}
                  </button>
                </>
              )}
            </div>
          </div>
        }
      />
      {isSubmitted && !revising && errors !== null && exercise.template === "species_counterpoint" && (() => {
        const grouped = new Map<string, { fullName: string; count: number }>();
        for (const e of errors) {
          const existing = grouped.get(e.label);
          if (existing) existing.count++;
          else grouped.set(e.label, { fullName: e.fullName, count: 1 });
        }
        const allRuleLabels: Record<string, string> = {
          "\u22255": "Parallel Fifths", "\u22258": "Parallel Octaves",
          "\u2225 5": "Parallel Fifths", "\u2225 8": "Parallel Octaves",
          "\u21925": "Direct Fifths", "\u21928": "Direct Octaves",
          "\u2192 5": "Direct Fifths", "\u2192 8": "Direct Octaves",
          "VX": "Voice Crossing", "Sp": "Spacing Error",
          "2LT": "Doubled Leading Tone", "LT\u2191": "Unresolved Leading Tone",
          "7\u2193": "Unresolved Chordal 7th", "2R": "Root Not Doubled",
          "Diss": "Dissonant Interval", "!PC": "Imperfect Consonance (Perfect Required)",
          "Mel": "Forbidden Melodic Interval", "Rep": "Repeated Pitch",
          "U!": "Unison Not at Endpoints", "Pen": "Bad Penultimate Approach",
        };
        const isSpecies = exercise.template === "species_counterpoint";
        const relevantRules = isSpecies
          ? ["Diss", "!PC", "Mel", "Rep", "U!", "Pen", "\u22255", "\u22258", "VX"]
          : ["\u22255", "\u22258", "\u21925", "\u21928", "VX", "Sp", "2LT", "LT\u2191", "7\u2193", "2R"];
        const violated = Array.from(grouped.entries());
        const satisfiedRules = relevantRules.filter(r => !grouped.has(r));
        const hasErrors = errors.length > 0;
        return (
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 24px", width: "100%" }}>
            <button
              onClick={() => setFeedbackOpen(!feedbackOpen)}
              style={{
                background: dk ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: feedbackOpen ? "8px 8px 0 0" : 8,
                padding: "8px 14px",
                width: "100%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontFamily: "inherit",
                color: theme.text,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {hasErrors
                  ? `${errors.length} issue${errors.length !== 1 ? "s" : ""} found`
                  : "No issues found"}
              </span>
              <span style={{ fontSize: 11, color: theme.textMuted }}>
                {feedbackOpen ? "\u25B2" : "\u25BC"}
              </span>
            </button>
            {feedbackOpen && (
              <div style={{
                background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                border: `1px solid ${theme.cardBorder}`,
                borderTop: "none",
                borderRadius: "0 0 8px 8px",
                padding: "10px 14px",
                fontSize: 13,
                lineHeight: 1.6,
              }}>
                {violated.length > 0 && (
                  <div style={{ marginBottom: satisfiedRules.length > 0 ? 8 : 0 }}>
                    {violated.map(([label, { fullName, count }]) => (
                      <div key={label} style={{ color: dk ? "#fbbf24" : "#d97706" }}>
                        {"\u2717"} {fullName}{count > 1 ? ` (\u00D7${count})` : ""}
                      </div>
                    ))}
                  </div>
                )}
                {satisfiedRules.length > 0 && (
                  <div>
                    {satisfiedRules.map(r => (
                      <div key={r} style={{ color: dk ? "#4ade80" : "#16a34a" }}>
                        {"\u2713"} {allRuleLabels[r] || r}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

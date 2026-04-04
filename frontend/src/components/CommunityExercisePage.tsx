import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth, API_BASE } from "../auth";
import { NoteEditor } from "./staff";
import type { LessonConfig, LessonErrorItem } from "./staff/types";
import { useTheme } from "../useTheme";
import { VoteWidget } from "./VoteWidget";
import { ShareButton } from "./ShareButton";
import { SignupModal } from "./SignupModal";

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
  contentUpdatedAt: string;
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
  shared: boolean;
  upvoteCount: number;
}

export function CommunityExercisePage() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();
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
  const [shareOnSubmit, setShareOnSubmit] = useState(true);
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const [revising, setRevising] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(true);

  // Signup modal state
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<"save" | "submit" | null>(null);

  const headers = token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : undefined;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const safeFetch = (url: string, needsAuth = false) => {
      if (needsAuth && !token) return Promise.resolve(null);
      const opts = token ? { headers } : {};
      return fetch(url, opts).then(r => r.ok ? r.json() : null).catch(() => null);
    };
    Promise.all([
      safeFetch(`${API_BASE}/api/community/exercises/${id}`),
      safeFetch(`${API_BASE}/api/community/exercises/${id}/attempt`, true),
      safeFetch(`${API_BASE}/api/community/exercises/${id}/vote`, true),
    ]).then(([ex, att, vote]) => {
      setExercise(ex);
      setAttempt(att);
      setUserVote(vote?.vote || null);
      setLoading(false);
    });
  }, [token, id]);

  const isOwnExercise = exercise?.creatorId === user?.id;
  // Discard stale draft attempts when the exercise content has been updated since the save.
  const attemptIsStale = attempt && exercise
    && attempt.status !== "submitted"
    && new Date(exercise.contentUpdatedAt) > new Date(attempt.savedAt);
  const effectiveAttempt = attemptIsStale ? null : attempt;
  const isSubmitted = effectiveAttempt?.status === "submitted";

  // Auto-enable checking when viewing a submitted exercise so errors are computed
  useEffect(() => {
    if (isSubmitted && !revising) {
      setChecked(true);
    } else if (revising) {
      setChecked(false);
    }
  }, [isSubmitted, revising]);

  // After signup, execute the pending action
  const pendingActionRef = useRef(pendingAction);
  pendingActionRef.current = pendingAction;
  useEffect(() => {
    if (token && pendingActionRef.current) {
      const action = pendingActionRef.current;
      setPendingAction(null);
      if (action === "submit") {
        handleSubmitAuth();
      } else if (action === "save") {
        handleSaveAuth();
      }
    }
  }, [token]);

  const handleVote = async (vote: string) => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/community/exercises/${id}/vote`, {
      method: "POST",
      headers: headers!,
      body: JSON.stringify({ vote }),
    });
    if (res.ok) {
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

  const handleSaveAuth = async () => {
    if (!latestBeats || !id || !token) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/community/exercises/${id}/attempt`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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

  const handleSave = () => {
    if (!token) {
      setPendingAction("save");
      setShowSignupModal(true);
      return;
    }
    handleSaveAuth();
  };

  const handleCheck = () => {
    setChecked(true);
  };

  const handleSubmitAuth = async () => {
    if (!id || !token) return;
    // Save first
    if (latestBeats) {
      setSaving(true);
      try {
        await fetch(`${API_BASE}/api/community/exercises/${id}/attempt`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            trebleBeats: latestBeats.treble || [],
            bassBeats: latestBeats.bass || [],
            studentRomans: studentRomans || [],
          }),
        });
      } finally {
        setSaving(false);
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/community/exercises/${id}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ shared: shareOnSubmit }),
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

  const handleSubmit = () => {
    if (!token) {
      setPendingAction("submit");
      setShowSignupModal(true);
      return;
    }
    handleSubmitAuth();
  };

  const handleSignupSuccess = () => {
    setShowSignupModal(false);
    // The useEffect watching `token` will pick up the pending action
  };

  const lessonConfig: LessonConfig | null = useMemo(() => {
    if (!exercise) return null;

    if (exercise.template === "species_counterpoint") {
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

    const isRN = exercise.template === "rn_analysis";
    return {
      lockedTrebleBeats: (exercise.template === "harmonize_melody" || isRN) ? exercise.sopranoBeats : [],
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
      template: isRN ? "roman_numeral_analysis" : undefined,
    };
  }, [exercise, handleErrorsComputed, handleRomansComputed, handleStudentRomansChanged, handleBeatsChanged, checked]);

  const mySubmittedLessonConfig: LessonConfig | null = useMemo(() => {
    if (!exercise || !attempt) return null;
    const base = {
      tonicIdx: exercise.tonicIdx,
      scaleName: exercise.template === "species_counterpoint" ? "none" : exercise.scaleName,
      tsTop: exercise.tsTop,
      tsBottom: exercise.tsBottom,
      checked: true,
      showStudentRomans: true,
      initialStudentRomans: attempt.studentRomans || undefined,
      onErrorsComputed: handleErrorsComputed,
    };
    if (exercise.template === "species_counterpoint") {
      const cfIsSoprano = exercise.sopranoBeats && exercise.sopranoBeats.length > 0
        && (!exercise.bassBeats || exercise.bassBeats.length === 0);
      return {
        ...base,
        lockedTrebleBeats: cfIsSoprano ? exercise.sopranoBeats : [],
        lockedBassBeats: cfIsSoprano ? undefined : (exercise.bassBeats || undefined),
        forceDuration: "whole" as const,
        template: "species_counterpoint",
      };
    }
    const isRN = exercise.template === "rn_analysis";
    return {
      ...base,
      lockedTrebleBeats: (exercise.template === "harmonize_melody" || isRN) ? exercise.sopranoBeats : [],
      lockedBassBeats: exercise.bassBeats || undefined,
      figuredBass: exercise.figuredBass || undefined,
      template: isRN ? "roman_numeral_analysis" : undefined,
    };
  }, [exercise, attempt, handleErrorsComputed]);

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
      <div style={{ minHeight: "100vh", paddingTop: 44, background: theme.bg, color: theme.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading...
      </div>
    );
  }

  if (!exercise || !lessonConfig) {
    return (
      <div style={{ minHeight: "100vh", paddingTop: 44, background: theme.bg, color: theme.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Exercise not found</div>
        <Link to="/community" style={{ color: theme.accent }}>Back to community</Link>
      </div>
    );
  }

  const showSubmittedView = isSubmitted && !revising;

  return (
    <div style={{ minHeight: "100vh", paddingTop: 44, display: "flex", flexDirection: "column" }}>
      {showSignupModal && (
        <SignupModal onSuccess={handleSignupSuccess} onClose={() => { setShowSignupModal(false); setPendingAction(null); }} />
      )}

      {showSubmittedView ? (
        <>
          <NoteEditor
            key={attempt?.id ?? "submitted"}
            lessonConfig={mySubmittedLessonConfig ?? lessonConfig}
            readOnly={true}
            maxWidth={1200}
            initialTrebleBeats={attempt?.trebleBeats || undefined}
            initialBassBeats={attempt?.bassBeats || undefined}
            onSvgRef={setSvgEl}
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
                  {token && !isOwnExercise && (
                    <VoteWidget
                      count={(exercise.upvotes || 0) - (exercise.downvotes || 0)}
                      userVote={userVote}
                      onVote={handleVote}
                    />
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: attempt?.completed ? "#16a34a" : "#d97706" }}>
                    {attempt?.completed ? "Completed" : "Submitted"}{attempt?.score !== null && ` ${attempt?.score}%`}
                  </span>
                  {!isOwnExercise && (
                    <button onClick={() => setRevising(true)} style={{
                      ...btnStyle, padding: "4px 12px", fontSize: 12,
                      background: "transparent", color: theme.accent,
                      border: `1px solid ${theme.accent}`,
                    }}>Revise</button>
                  )}
                  {id && (
                    <ShareButton
                      svgElement={svgEl}
                      sourceType="exercise"
                      sourceId={id}
                      title={exercise.title}
                      description={exercise.description}
                      style={{
                        ...btnStyle, padding: "4px 12px", fontSize: 12,
                        background: "transparent", color: theme.accent,
                        border: `1px solid ${theme.accent}`,
                      }}
                    />
                  )}
                </div>
              </div>
            }
          />
          {errors !== null && exercise.template === "species_counterpoint" && renderSpeciesFeedback()}
        </>
      ) : (
        /* Working / revising view — shown to everyone including unauthenticated */
        <>
          <NoteEditor
            key="exercise-editor"
            lessonConfig={lessonConfig}
            readOnly={false}
            maxWidth={1200}
            initialTrebleBeats={effectiveAttempt?.trebleBeats || undefined}
            initialBassBeats={effectiveAttempt?.bassBeats || undefined}
            onSvgRef={setSvgEl}
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
                  {token && !isOwnExercise && (
                    <VoteWidget
                      count={(exercise.upvotes || 0) - (exercise.downvotes || 0)}
                      userVote={userVote}
                      onVote={handleVote}
                    />
                  )}
                  {isOwnExercise && (
                    <span style={{ fontSize: 12, color: theme.textSub }}>Your exercise</span>
                  )}
                  {!isOwnExercise && (
                    <>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: theme.textSub, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={shareOnSubmit}
                          onChange={e => setShareOnSubmit(e.target.checked)}
                          style={{ margin: 0 }}
                        />
                        Share my solution
                      </label>
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
                      }}>Check</button>
                      <button onClick={handleSubmit} disabled={submitting} style={{
                        ...btnStyle, padding: "4px 12px", fontSize: 12,
                        opacity: submitting ? 0.6 : 1,
                      }}>
                        {submitting ? "Submitting..." : (revising ? "Resubmit" : "Submit")}
                      </button>
                    </>
                  )}
                  {id && (
                    <ShareButton
                      svgElement={svgEl}
                      sourceType="exercise"
                      sourceId={id}
                      title={exercise.title}
                      description={exercise.description}

                      style={{
                        ...btnStyle, padding: "4px 12px", fontSize: 12,
                        background: "transparent", color: theme.accent,
                        border: `1px solid ${theme.accent}`,
                      }}
                    />
                  )}
                </div>
              </div>
            }
          />
          {isSubmitted && revising && errors !== null && exercise.template === "species_counterpoint" && renderSpeciesFeedback()}
        </>
      )}
    </div>
  );

  function renderSpeciesFeedback() {
    if (!errors || !exercise) return null;
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
    const relevantRules = ["Diss", "!PC", "Mel", "Rep", "U!", "Pen", "\u22255", "\u22258", "VX"];
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
  }
}

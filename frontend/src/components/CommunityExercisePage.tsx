import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth, API_BASE } from "../auth";
import { NoteEditor } from "./staff";
import type { LessonConfig, LessonErrorItem } from "./staff/types";
import { useTheme } from "../useTheme";
import { TEMPLATE_LABELS, DIFFICULTY_COLORS, NOTE_NAMES } from "../constants";
import { VoteWidget } from "./VoteWidget";

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
  shared: boolean;
  upvoteCount: number;
}

interface SharedSolution {
  attemptId: string;
  userId: string;
  displayName: string;
  trebleBeats: any;
  bassBeats: any;
  studentRomans: any;
  score: number | null;
  completed: boolean;
  submittedAt: string | null;
  upvoteCount: number;
  userUpvoted: boolean;
}

type ExerciseTab = "my-solution" | "solutions";

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

  // Solution gallery state
  const [activeTab, setActiveTab] = useState<ExerciseTab | null>(null);
  const [solutions, setSolutions] = useState<SharedSolution[]>([]);
  const [solutionsLoading, setSolutionsLoading] = useState(false);
  const [shareOnSubmit, setShareOnSubmit] = useState(true);
  const [expandedSolution, setExpandedSolution] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

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
  // Discard stale attempts when the exercise has been updated since the save
  const attemptIsStale = attempt && exercise
    && new Date(exercise.updatedAt) > new Date(attempt.savedAt);
  const effectiveAttempt = attemptIsStale ? null : attempt;
  const isSubmitted = effectiveAttempt?.status === "submitted";
  const [revising, setRevising] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(true);

  // Default tab: authors without a submission and unauthenticated users go straight to solutions
  useEffect(() => {
    if (activeTab === null && !loading) {
      if (!token || (isOwnExercise && !isSubmitted)) {
        setActiveTab("solutions");
      } else {
        setActiveTab("my-solution");
      }
    }
  }, [loading, isOwnExercise, isSubmitted, activeTab, token]);

  // Auto-enable checking when viewing a submitted exercise so errors are computed
  useEffect(() => {
    if (isSubmitted && !revising) {
      setChecked(true);
    } else if (revising) {
      setChecked(false);
    }
  }, [isSubmitted, revising]);

  // Fetch solutions when switching to solutions tab
  useEffect(() => {
    if (activeTab === "solutions" && id) {
      setSolutionsLoading(true);
      const opts = token ? { headers } : {};
      fetch(`${API_BASE}/api/community/exercises/${id}/solutions`, opts)
        .then(r => r.ok ? r.json() : [])
        .then(data => { setSolutions(data); setSolutionsLoading(false); })
        .catch(() => setSolutionsLoading(false));
    }
  }, [activeTab, id, token]);

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

  const handleSolutionUpvote = async (attemptId: string) => {
    const res = await fetch(`${API_BASE}/api/community/exercises/${id}/solutions/${attemptId}/upvote`, {
      method: "POST",
      headers,
    });
    if (res.ok) {
      const { upvoted } = await res.json();
      setSolutions(prev => prev.map(s =>
        s.attemptId === attemptId
          ? { ...s, userUpvoted: upvoted, upvoteCount: s.upvoteCount + (upvoted ? 1 : -1) }
          : s
      ));
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
    return {
      ...base,
      lockedTrebleBeats: exercise.template === "harmonize_melody" ? exercise.sopranoBeats : [],
      lockedBassBeats: exercise.bassBeats || undefined,
      figuredBass: exercise.figuredBass || undefined,
    };
  }, [exercise, attempt, handleErrorsComputed]);

  const makeSolutionLessonConfig = (sol: SharedSolution): LessonConfig | null => {
    if (!exercise) return null;
    const base = {
      tonicIdx: exercise.tonicIdx,
      scaleName: exercise.template === "species_counterpoint" ? "none" : exercise.scaleName,
      tsTop: exercise.tsTop,
      tsBottom: exercise.tsBottom,
      checked: true,
      showStudentRomans: true,
      initialStudentRomans: sol.studentRomans || undefined,
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
    return {
      ...base,
      lockedTrebleBeats: exercise.template === "harmonize_melody" ? exercise.sopranoBeats : [],
      lockedBassBeats: exercise.bassBeats || undefined,
      figuredBass: exercise.figuredBass || undefined,
    };
  };

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

  const showTabs = (isSubmitted && !revising) || isOwnExercise || !token;

  return (
    <div style={{ minHeight: "100vh", paddingTop: 44, display: "flex", flexDirection: "column" }}>
      {showTabs ? (
        <>
          {/* Tab bar */}
          <div style={{
            maxWidth: 960, width: "100%", margin: "0 auto", padding: "12px 24px 0",
            display: "flex", gap: 0,
          }}>
            {(isSubmitted && token ? ["my-solution", "solutions"] as ExerciseTab[] : ["solutions"] as ExerciseTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "8px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  background: activeTab === tab ? (dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)") : "transparent",
                  color: activeTab === tab ? theme.text : theme.textMuted,
                  border: `1px solid ${activeTab === tab ? theme.cardBorder : "transparent"}`,
                  borderBottom: activeTab === tab ? "none" : `1px solid ${theme.cardBorder}`,
                  borderRadius: "8px 8px 0 0",
                  cursor: "pointer",
                }}
              >
                {tab === "my-solution" ? "My Solution" : "Solutions"}
              </button>
            ))}
            <div style={{ flex: 1, borderBottom: `1px solid ${theme.cardBorder}` }} />
          </div>

          {activeTab === "my-solution" ? (
            <>
              <NoteEditor
                key={attempt?.id ?? "no-attempt"}
                lessonConfig={mySubmittedLessonConfig ?? lessonConfig}
                readOnly={true}
                maxWidth={1200}
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
                    </div>
                  </div>
                }
              />
              {/* Species counterpoint feedback */}
              {errors !== null && exercise.template === "species_counterpoint" && renderSpeciesFeedback()}
            </>
          ) : (
            /* Solutions tab */
            <div style={{ maxWidth: 960, width: "100%", margin: "0 auto", padding: "16px 24px" }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Link to="/community" style={{ fontSize: 13, color: theme.textMuted, textDecoration: "none" }}>&larr;</Link>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{exercise.title}</span>
                </div>
                {exercise.description && (
                  <div style={{ fontSize: 14, color: theme.textSub, lineHeight: 1.5, marginTop: 8, paddingLeft: 21 }}>
                    {exercise.description}
                  </div>
                )}
              </div>
              {solutionsLoading ? (
                <div style={{ textAlign: "center", padding: 32, color: theme.textMuted }}>Loading solutions...</div>
              ) : solutions.length === 0 ? (
                <div style={{ textAlign: "center", padding: 32, color: theme.textMuted }}>No shared solutions yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {solutions.map(sol => {
                    const isExpanded = expandedSolution === sol.attemptId;
                    const solConfig = isExpanded ? makeSolutionLessonConfig(sol) : null;
                    return (
                      <div key={sol.attemptId} style={{
                        border: `1px solid ${theme.cardBorder}`,
                        borderRadius: 8,
                        overflow: "hidden",
                      }}>
                        <button
                          onClick={() => setExpandedSolution(isExpanded ? null : sol.attemptId)}
                          style={{
                            width: "100%",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "12px 16px",
                            background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                            border: "none",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            color: theme.text,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{sol.displayName}</span>
                            {sol.score !== null && (
                              <span style={{ fontSize: 12, color: sol.completed ? "#16a34a" : "#d97706" }}>
                                {sol.score}%
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <VoteWidget
                              count={sol.upvoteCount}
                              userVote={sol.userUpvoted ? "up" : null}
                              onVote={token && sol.userId !== user?.id ? () => handleSolutionUpvote(sol.attemptId) : undefined}
                              upvoteOnly
                              compact
                            />
                            <span style={{ fontSize: 11, color: theme.textMuted }}>
                              {isExpanded ? "\u25B2" : "\u25BC"}
                            </span>
                          </div>
                        </button>
                        {isExpanded && solConfig && (
                          <div style={{ borderTop: `1px solid ${theme.cardBorder}` }}>
                            <NoteEditor
                              key={sol.attemptId}
                              lessonConfig={solConfig}
                              readOnly={true}
                              maxWidth={1200}
                              initialTrebleBeats={sol.trebleBeats || undefined}
                              initialBassBeats={sol.bassBeats || undefined}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Pre-submission / revising view */
        <>
          <NoteEditor
            key={effectiveAttempt?.id ?? "no-attempt"}
            lessonConfig={lessonConfig}
            readOnly={false}
            maxWidth={1200}
            initialTrebleBeats={effectiveAttempt?.trebleBeats || undefined}
            initialBassBeats={effectiveAttempt?.bassBeats || undefined}
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
                </div>
              </div>
            }
          />
          {/* Species counterpoint feedback for revising */}
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

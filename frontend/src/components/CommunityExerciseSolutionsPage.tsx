import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth, API_BASE } from "../auth";
import { NoteEditor } from "./staff";
import type { LessonConfig } from "./staff/types";
import { useTheme } from "../useTheme";
import { VoteWidget } from "./VoteWidget";
import { ShareButton } from "./ShareButton";

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
  upvotes: number;
  downvotes: number;
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

export function CommunityExerciseSolutionsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const theme = useTheme();
  const dk = theme.dk;

  const [exercise, setExercise] = useState<CommunityExercise | null>(null);
  const [solutions, setSolutions] = useState<SharedSolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSolution, setExpandedSolution] = useState<string | null>(null);
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);

  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : {};

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const opts = token ? { headers } : undefined;
    Promise.all([
      fetch(`${API_BASE}/api/community/exercises/${id}`, opts).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/community/exercises/${id}/solutions`, opts).then(r => r.ok ? r.json() : []),
    ]).then(([ex, sols]) => {
      setExercise(ex);
      setSolutions(sols);
      setLoading(false);
    });
  }, [id, token]);

  const handleSolutionUpvote = async (attemptId: string) => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/community/exercises/${id}/solutions/${attemptId}/upvote`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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

  const exercisePreviewConfig: LessonConfig | null = useMemo(() => {
    if (!exercise) return null;
    const base = {
      tonicIdx: exercise.tonicIdx,
      scaleName: exercise.template === "species_counterpoint" ? "none" : exercise.scaleName,
      tsTop: exercise.tsTop,
      tsBottom: exercise.tsBottom,
      checked: false,
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
  }, [exercise]);

  const makeSolutionConfig = (sol: SharedSolution): LessonConfig | null => {
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
    const isRN = exercise.template === "rn_analysis";
    return {
      ...base,
      lockedTrebleBeats: (exercise.template === "harmonize_melody" || isRN) ? exercise.sopranoBeats : [],
      lockedBassBeats: exercise.bassBeats || undefined,
      figuredBass: exercise.figuredBass || undefined,
      template: isRN ? "roman_numeral_analysis" : undefined,
    };
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", paddingTop: 44, background: theme.bg, color: theme.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading...
      </div>
    );
  }

  if (!exercise || !exercisePreviewConfig) {
    return (
      <div style={{ minHeight: "100vh", paddingTop: 44, background: theme.bg, color: theme.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Exercise not found</div>
        <Link to="/community" style={{ color: theme.accent }}>Back to community</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", paddingTop: 44, display: "flex", flexDirection: "column" }}>
      <NoteEditor
        key="exercise-preview"
        lessonConfig={exercisePreviewConfig}
        readOnly={true}
        maxWidth={1200}
        onSvgRef={setSvgEl}
        header={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link to={`/community/${id}`} style={{ fontSize: 13, color: theme.textMuted, textDecoration: "none" }}>
                &larr;
              </Link>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{exercise.title}</span>
              <span style={{ fontSize: 13, color: theme.textMuted }}>&mdash; Solutions</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Link
                to={`/community/${id}`}
                style={{
                  padding: "4px 12px", fontSize: 12, fontWeight: 600,
                  color: theme.accent, border: `1px solid ${theme.accent}`,
                  borderRadius: 8, textDecoration: "none",
                }}
              >
                Try it
              </Link>
              {id && token && (
                <ShareButton
                  svgElement={svgEl}
                  sourceType="exercise"
                  sourceId={id}
                  title={exercise.title}
                  description={exercise.description}
                  style={{
                    padding: "4px 12px", fontSize: 12, fontWeight: 600,
                    background: "transparent", color: theme.accent,
                    border: `1px solid ${theme.accent}`,
                    borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                  }}
                />
              )}
            </div>
          </div>
        }
        subheader={exercise.description ? (
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "12px 24px 0", fontSize: 14, color: theme.textSub, lineHeight: 1.5 }}>
            {exercise.description}
          </div>
        ) : undefined}
      />
      <div style={{ maxWidth: 960, width: "100%", margin: "0 auto", padding: "16px 24px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
          {solutions.length} Solution{solutions.length !== 1 ? "s" : ""}
        </h3>
        {solutions.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: theme.textMuted }}>
            No shared solutions yet.{" "}
            <Link to={`/community/${id}`} style={{ color: theme.accent }}>Be the first!</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {solutions.map(sol => {
              const isExpanded = expandedSolution === sol.attemptId;
              const solConfig = isExpanded ? makeSolutionConfig(sol) : null;
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
    </div>
  );
}

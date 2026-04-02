import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, API_BASE } from "../auth";
import { NoteEditor } from "./staff";
import type { LessonConfig } from "./staff/types";
import { useTheme } from "../useTheme";
import { TEMPLATE_LABELS, DIFFICULTY_COLORS, TONIC_LABELS } from "../constants";

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

interface PointsSummary {
  totalPoints: number;
  streak: number;
  rankTitle: string;
  displayName: string;
  nextRank: string | null;
  nextThreshold: number | null;
}

interface LeaderboardRow {
  userId: string;
  displayName: string;
  totalPoints: number;
  rankTitle: string;
}

type Tab = "browse" | "mine" | "create" | "leaderboard";

const SCALE_NAMES = ["major", "minor"];
const TEMPLATES = ["harmonize_melody", "rn_analysis", "species_counterpoint"];
const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert", "unknown"];

export function CommunityPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const dk = theme.dk;

  const [tab, setTab] = useState<Tab>("browse");
  const [exercises, setExercises] = useState<CommunityExercise[]>([]);
  const [myExercises, setMyExercises] = useState<CommunityExercise[]>([]);
  const [points, setPoints] = useState<PointsSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [lbTimeframe, setLbTimeframe] = useState<"alltime" | "weekly">("alltime");
  const [showPointsInfo, setShowPointsInfo] = useState(false);
  const [loading, setLoading] = useState(true);

  // Browse filters & sort
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterTemplate, setFilterTemplate] = useState("");
  const [filterKey, setFilterKey] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "most_attempted" | "highest_rated" | "least_attempted">("newest");

  const filteredExercises = useMemo(() => {
    let list = exercises;
    if (filterDifficulty) list = list.filter(e => e.inferredDifficulty === filterDifficulty);
    if (filterTemplate) list = list.filter(e => e.template === filterTemplate);
    if (filterKey) list = list.filter(e => String(e.tonicIdx) === filterKey);
    switch (sortBy) {
      case "newest": return list; // already sorted by createdAt DESC from API
      case "most_attempted": return [...list].sort((a, b) => b.attemptCount - a.attemptCount);
      case "highest_rated": return [...list].sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
      case "least_attempted": return [...list].sort((a, b) => a.attemptCount - b.attemptCount);
    }
  }, [exercises, filterDifficulty, filterTemplate, filterKey, sortBy]);

  // Create form state
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createTemplate, setCreateTemplate] = useState("harmonize_melody");
  const [createTonicIdx, setCreateTonicIdx] = useState(0);
  const [createScale, setCreateScale] = useState("major");
  const [createTsTop, setCreateTsTop] = useState(4);
  const [createTsBottom, setCreateTsBottom] = useState(4);
  const [createTags, setCreateTags] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createCfVoice, setCreateCfVoice] = useState<"soprano" | "bass">("bass");
  const [editingExercise, setEditingExercise] = useState<CommunityExercise | null>(null);

  const [editorBeats, setEditorBeats] = useState<any>(null);
  const editorBeatsRef = useRef(editorBeats);
  editorBeatsRef.current = editorBeats;

  const handleTrebleChanged = useCallback((treble: any) => {
    setEditorBeats({ ...editorBeatsRef.current, sopranoBeats: treble });
  }, []);

  const handleBassChanged = useCallback((bass: any) => {
    setEditorBeats({ ...editorBeatsRef.current, bassBeats: bass });
  }, []);

  const createLessonConfig: LessonConfig | undefined = useMemo(() => {
    if (createTemplate !== "species_counterpoint") return undefined;
    return {
      lockedTrebleBeats: [],
      tonicIdx: createTonicIdx,
      scaleName: "none",
      tsTop: createTsTop,
      tsBottom: createTsBottom,
      forceDuration: "whole" as const,
      template: "species_counterpoint",
    };
  }, [createTemplate, createTonicIdx, createTsTop, createTsBottom]);

  const communityInputBg = dk ? "#1a1a1e" : "#f5f3f0";
  const communityInputBorder = dk ? "#444" : "#ccc";

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/community/exercises`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/community/points`, { headers }).then(r => r.ok ? r.json() : null),
    ]).then(([exs, pts]) => {
      setExercises(exs);
      setPoints(pts);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (tab === "mine" && token) {
      fetch(`${API_BASE}/api/community/exercises/mine`, { headers })
        .then(r => r.ok ? r.json() : [])
        .then(setMyExercises)
        .catch(() => {});
    }
  }, [tab, token]);

  useEffect(() => {
    if (tab === "leaderboard" && token) {
      fetch(`${API_BASE}/api/community/leaderboard?timeframe=${lbTimeframe}`, { headers })
        .then(r => r.ok ? r.json() : [])
        .then(setLeaderboard)
        .catch(() => {});
    }
  }, [tab, lbTimeframe, token]);

  // Pitch class from dp + accidental (for CF tonic validation)
  const LETTER_TO_PC = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
  // Maps TONIC_LABELS indices to pitch classes (matches backend tonicByIdx):
  // 0:C=0, 1:C#=1, 2:Db=1, 3:D=2, 4:Eb=3, 5:E=4, 6:F=5, 7:F#=6, 8:Gb=6, 9:G=7, 10:Ab=8, 11:A=9, 12:Bb=10, 13:B=11
  const TONIC_PC_BY_IDX = [0, 1, 1, 2, 3, 4, 5, 6, 6, 7, 8, 9, 10, 11];
  const dpToPitchClass = (dp: number, acc: string): number => {
    const letterIdx = ((dp % 7) + 7) % 7;
    let pc = LETTER_TO_PC[letterIdx];
    if (acc === "#") pc = (pc + 1) % 12;
    else if (acc === "b") pc = (pc + 11) % 12;
    return pc;
  };

  const validateCfTonic = (cfBeats: any[], tonicIdx: number): string | null => {
    const notes = cfBeats.filter((b: any) => !b.isRest && b.notes?.length > 0);
    if (notes.length < 2) return "Cantus firmus must have at least 2 notes";
    const tonicPc = TONIC_PC_BY_IDX[tonicIdx];
    const firstNote = notes[0].notes[0];
    const lastNote = notes[notes.length - 1].notes[0];
    const firstPc = dpToPitchClass(firstNote.dp, firstNote.accidental || "");
    const lastPc = dpToPitchClass(lastNote.dp, lastNote.accidental || "");
    if (firstPc !== tonicPc) return "Cantus firmus must start on the tonic";
    if (lastPc !== tonicPc) return "Cantus firmus must end on the tonic";
    return null;
  };

  const handleCreate = async () => {
    if (!createTitle.trim()) { setCreateError("Title is required"); return; }
    setCreating(true);
    setCreateError("");
    try {
      let sopranoBeats = editorBeats?.sopranoBeats || [];
      let bassBeats = editorBeats?.bassBeats || null;
      if (createTemplate === "species_counterpoint") {
        if (createCfVoice === "soprano") {
          sopranoBeats = editorBeats?.sopranoBeats || [];
          bassBeats = null;
        } else {
          bassBeats = editorBeats?.bassBeats || [];
          sopranoBeats = [];
        }
        // Validate CF starts and ends on tonic
        const cfBeats = createCfVoice === "soprano" ? sopranoBeats : bassBeats;
        if (cfBeats) {
          const cfError = validateCfTonic(cfBeats, createTonicIdx);
          if (cfError) { setCreateError(cfError); setCreating(false); return; }
        }
      }
      const body: any = {
        title: createTitle.trim(),
        description: createDesc.trim(),
        template: createTemplate,
        tonicIdx: createTonicIdx,
        scaleName: createScale,
        tsTop: createTsTop,
        tsBottom: createTsBottom,
        sopranoBeats,
        bassBeats,
        figuredBass: editorBeats?.figuredBass || null,
        referenceSolution: editorBeats?.referenceSolution || null,
        rnAnswerKey: editorBeats?.rnAnswerKey || null,
        tags: createTags.split(",").map(t => t.trim()).filter(Boolean),
      };
      const res = await fetch(`${API_BASE}/api/community/exercises`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCreateError(err.errors?.join(", ") || err.error || "Failed to create");
        return;
      }
      const ex = await res.json();
      setMyExercises(prev => [ex, ...prev]);
      setTab("mine");
      setCreateTitle("");
      setCreateDesc("");
      setCreateTags("");
      setEditorBeats(null);

    } catch {
      setCreateError("Network error");
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/community/exercises/${id}/publish`, {
      method: "POST",
      headers,
    });
    if (res.ok) {
      const ex = await res.json();
      setMyExercises(prev => prev.map(e => e.id === id ? ex : e));
      setExercises(prev => [ex, ...prev]);
    }
  };

  const handleUnpublish = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/community/exercises/${id}/unpublish`, {
      method: "POST",
      headers,
    });
    if (res.ok) {
      const ex = await res.json();
      setMyExercises(prev => prev.map(e => e.id === id ? ex : e));
      setExercises(prev => prev.filter(e => e.id !== id));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this exercise?")) return;
    await fetch(`${API_BASE}/api/community/exercises/${id}`, {
      method: "DELETE",
      headers,
    });
    setMyExercises(prev => prev.filter(e => e.id !== id));
    setExercises(prev => prev.filter(e => e.id !== id));
  };

  const handleEdit = (ex: CommunityExercise) => {
    setEditingExercise(ex);
    setCreateTitle(ex.title);
    setCreateDesc(ex.description);
    setCreateTemplate(ex.template);
    setCreateTonicIdx(ex.tonicIdx);
    setCreateScale(ex.scaleName);
    setCreateTsTop(ex.tsTop);
    setCreateTsBottom(ex.tsBottom);
    setCreateTags(ex.tags.join(", "));
    if (ex.template === "species_counterpoint") {
      const cfIsBass = ex.bassBeats && ex.bassBeats.length > 0;
      setCreateCfVoice(cfIsBass ? "bass" : "soprano");
    }
    setEditorBeats({ sopranoBeats: ex.sopranoBeats, bassBeats: ex.bassBeats });
    setTab("create");
  };

  const handleCancelEdit = () => {
    setEditingExercise(null);
    setCreateTitle("");
    setCreateDesc("");
    setCreateTemplate("harmonize_melody");
    setCreateTonicIdx(0);
    setCreateScale("major");
    setCreateTsTop(4);
    setCreateTsBottom(4);
    setCreateTags("");
    setCreateCfVoice("bass");
    setEditorBeats(null);
    setCreateError("");
  };

  const handleUpdate = async () => {
    if (!editingExercise) return;
    if (!createTitle.trim()) { setCreateError("Title is required"); return; }
    setCreating(true);
    setCreateError("");
    try {
      let sopranoBeats = editorBeats?.sopranoBeats || [];
      let bassBeats = editorBeats?.bassBeats || null;
      if (createTemplate === "species_counterpoint") {
        if (createCfVoice === "soprano") {
          sopranoBeats = editorBeats?.sopranoBeats || [];
          bassBeats = null;
        } else {
          bassBeats = editorBeats?.bassBeats || [];
          sopranoBeats = [];
        }
        const cfBeats = createCfVoice === "soprano" ? sopranoBeats : bassBeats;
        if (cfBeats) {
          const cfError = validateCfTonic(cfBeats, createTonicIdx);
          if (cfError) { setCreateError(cfError); setCreating(false); return; }
        }
      }
      const body: any = {
        title: createTitle.trim(),
        description: createDesc.trim(),
        template: createTemplate,
        tonicIdx: createTonicIdx,
        scaleName: createScale,
        tsTop: createTsTop,
        tsBottom: createTsBottom,
        sopranoBeats,
        bassBeats,
        figuredBass: editorBeats?.figuredBass || null,
        referenceSolution: editorBeats?.referenceSolution || null,
        rnAnswerKey: editorBeats?.rnAnswerKey || null,
        tags: createTags.split(",").map(t => t.trim()).filter(Boolean),
      };
      const res = await fetch(`${API_BASE}/api/community/exercises/${editingExercise.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCreateError(err.errors?.join(", ") || err.error || "Failed to update");
        return;
      }
      const ex = await res.json();
      setMyExercises(prev => prev.map(e => e.id === ex.id ? ex : e));
      setExercises(prev => prev.map(e => e.id === ex.id ? ex : e));
      handleCancelEdit();
      setTab("mine");
    } catch {
      setCreateError("Network error");
    } finally {
      setCreating(false);
    }
  };

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: tab === t ? 700 : 500,
    background: "none",
    border: "none",
    borderBottom: tab === t ? `2px solid ${theme.accent}` : "2px solid transparent",
    color: tab === t ? theme.accent : theme.textSub,
    cursor: "pointer",
    fontFamily: "inherit",
  });

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg,
    borderRadius: 12,
    padding: "20px 24px",
    boxShadow: theme.cardShadow,
    border: `1px solid ${theme.cardBorder}`,
    color: theme.text,
    marginBottom: 12,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 14,
    background: communityInputBg,
    border: `1px solid ${communityInputBorder}`,
    borderRadius: 8,
    color: theme.text,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const filterSelectStyle: React.CSSProperties = {
    padding: "6px 10px",
    fontSize: 13,
    background: communityInputBg,
    border: `1px solid ${communityInputBorder}`,
    borderRadius: 6,
    color: theme.text,
    fontFamily: "inherit",
    cursor: "pointer",
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

  const renderExerciseCard = (ex: CommunityExercise, showActions = false) => (
    <div key={ex.id} style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <Link
            to={`/community/${ex.id}`}
            style={{ fontSize: 17, fontWeight: 700, color: theme.text, textDecoration: "none" }}
          >
            {ex.title}
          </Link>
          {ex.description && (
            <p style={{ fontSize: 13, color: theme.textSub, margin: "6px 0 0", lineHeight: 1.5 }}>
              {ex.description.length > 120 ? ex.description.slice(0, 120) + "..." : ex.description}
            </p>
          )}
          <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            {ex.creatorDisplayName && (
              <span style={{ fontSize: 12, color: theme.textMuted }}>
                by {ex.creatorDisplayName}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: dk ? "#333" : "#f0ede9", color: theme.textSub }}>
              {TEMPLATE_LABELS[ex.template] || ex.template}
            </span>
            <span style={{ fontSize: 12, color: theme.textSub }}>
              {TONIC_LABELS[ex.tonicIdx]}{ex.scaleName && ex.scaleName !== "none" ? ` ${ex.scaleName}` : ""}
            </span>
            <span style={{ fontSize: 12, color: theme.textSub }}>
              {ex.tsTop}/{ex.tsBottom}
            </span>
            <span style={{ fontSize: 12, color: DIFFICULTY_COLORS[ex.inferredDifficulty] || "#666" }}>
              {ex.inferredDifficulty}
            </span>
            {ex.tags.length > 0 && ex.tags.map(tag => (
              <span key={tag} style={{ fontSize: 11, padding: "1px 6px", borderRadius: 3, background: dk ? "#3a3a50" : "#e8e4f0", color: dk ? "#aab" : "#555" }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "flex-end", gap: 4, minWidth: 80 }}>
          {ex.attemptCount === 0 && ex.upvotes === 0 && ex.downvotes === 0 ? (
            <>
              <span style={{
                fontSize: 13, fontWeight: 700, padding: "3px 12px", borderRadius: 10,
                background: dk ? "rgba(124,156,255,0.15)" : "rgba(74,111,255,0.08)",
                color: theme.accent,
              }}>
                New
              </span>
              <span style={{ fontSize: 12, color: theme.accent }}>
                Be the first to try it
              </span>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6 }}>
                <span title="Upvotes" style={{
                  fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                  background: dk ? "rgba(22,163,74,0.15)" : "rgba(22,163,74,0.08)",
                  color: dk ? "#6ee7a0" : "#16a34a",
                }}>+{ex.upvotes}</span>
                <span title="Downvotes" style={{
                  fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                  background: dk ? "rgba(220,38,38,0.15)" : "rgba(220,38,38,0.08)",
                  color: dk ? "#fca5a5" : "#dc2626",
                }}>-{ex.downvotes}</span>
              </div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>
                {ex.attemptCount} attempt{ex.attemptCount !== 1 ? "s" : ""}
              </div>
            </>
          )}
          {ex.completionCount > 0 && (
            <div style={{ fontSize: 12, color: theme.textMuted }}>
              {Math.round(ex.completionRate * 100)}% completion
            </div>
          )}
        </div>
      </div>
      {showActions && ex.creatorId === user?.id && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, borderTop: `1px solid ${theme.cardBorder}`, paddingTop: 12 }}>
          <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 4, background: ex.status === "published" ? (dk ? "#1a3a1a" : "#e8f5e9") : (dk ? "#3a3a1a" : "#fff8e1"), color: ex.status === "published" ? "#16a34a" : "#d97706" }}>
            {ex.status.charAt(0).toUpperCase() + ex.status.slice(1)}
          </span>
          {ex.status === "draft" && (
            <>
              <button onClick={() => handleEdit(ex)} style={{ ...btnStyle, padding: "3px 12px", fontSize: 12, background: "transparent", color: theme.accent, border: `1px solid ${theme.accent}` }}>
                Edit
              </button>
              <button onClick={() => handlePublish(ex.id)} style={{ ...btnStyle, padding: "3px 12px", fontSize: 12 }}>
                Publish
              </button>
            </>
          )}
          {ex.status === "published" && (
            <button onClick={() => handleUnpublish(ex.id)} style={{ ...btnStyle, padding: "3px 12px", fontSize: 12, background: "transparent", color: "#d97706", border: "1px solid #d97706" }}>
              Unpublish
            </button>
          )}
          <button onClick={() => handleDelete(ex.id)} style={{ ...btnStyle, padding: "3px 12px", fontSize: 12, background: dk ? "#4a2020" : "#fde8e8", color: "#dc2626" }}>
            Remove
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: theme.bg, color: theme.text }}>
      {/* Header */}
      <div style={{ padding: "32px 24px 0", maxWidth: 800, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 8 }}>
          {points && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{points.rankTitle}</span>
              <span style={{ color: theme.textSub }}>{points.totalPoints} pts</span>
              {points.streak > 1 && (
                <span style={{ color: "#d97706" }}>{points.streak}-day streak</span>
              )}
            </div>
          )}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, margin: "0 0 4px" }}>Community</h1>
        <p style={{ fontSize: 14, color: theme.textSub, margin: "0 0 20px" }}>
          Create exercises, attempt others&apos; challenges, and climb the ranks
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${theme.cardBorder}`, marginBottom: 24 }}>
          <button style={tabStyle("browse")} onClick={() => setTab("browse")}>Browse</button>
          <button style={tabStyle("mine")} onClick={() => setTab("mine")}>My Exercises</button>
          <button style={tabStyle("create")} onClick={() => setTab("create")}>Create</button>
          <button style={tabStyle("leaderboard")} onClick={() => setTab("leaderboard")}>Leaderboard</button>
        </div>
      </div>

      {/* Content — non-create tabs */}
      {tab !== "create" && (
      <div style={{ maxWidth: 800, margin: "0 auto", width: "100%", padding: "0 24px 80px" }}>
        {loading && tab === "browse" && (
          <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>Loading...</div>
        )}

        {/* Browse Tab */}
        {tab === "browse" && !loading && (
          <>
            {/* Filters & Sort */}
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center",
            }}>
              <select
                value={filterTemplate}
                onChange={e => setFilterTemplate(e.target.value)}
                style={{ ...filterSelectStyle, minWidth: 160 }}
              >
                <option value="">All types</option>
                {TEMPLATES.map(t => <option key={t} value={t}>{TEMPLATE_LABELS[t]}</option>)}
              </select>
              <select
                value={filterDifficulty}
                onChange={e => setFilterDifficulty(e.target.value)}
                style={filterSelectStyle}
              >
                <option value="">All difficulties</option>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                value={filterKey}
                onChange={e => setFilterKey(e.target.value)}
                style={filterSelectStyle}
              >
                <option value="">All keys</option>
                {TONIC_LABELS.map((l, i) => <option key={i} value={String(i)}>{l}</option>)}
              </select>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                style={{ ...filterSelectStyle, marginLeft: "auto" }}
              >
                <option value="newest">Newest</option>
                <option value="most_attempted">Most attempted</option>
                <option value="least_attempted">Least attempted</option>
                <option value="highest_rated">Highest rated</option>
              </select>
            </div>
            {filteredExercises.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>
                {exercises.length === 0 ? "No exercises published yet. Be the first to create one!" : "No exercises match your filters."}
              </div>
            ) : (
              filteredExercises.map(ex => renderExerciseCard(ex))
            )}
          </>
        )}

        {/* My Exercises Tab */}
        {tab === "mine" && (
          <>
            {myExercises.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>
                You haven&apos;t created any exercises yet.
                <br />
                <button onClick={() => setTab("create")} style={{ ...btnStyle, marginTop: 16 }}>
                  Create your first exercise
                </button>
              </div>
            ) : (
              myExercises.map(ex => renderExerciseCard(ex, true))
            )}
          </>
        )}

        {/* Leaderboard Tab */}
        {tab === "leaderboard" && (
          <>
            {/* Points summary */}
            {points && (
              <div style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{points.rankTitle}</div>
                  <div style={{ fontSize: 14, color: theme.textSub }}>{points.totalPoints} total points</div>
                </div>
                <div style={{ display: "flex", gap: 24, fontSize: 14 }}>
                  {points.streak > 0 && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#d97706" }}>{points.streak}</div>
                      <div style={{ fontSize: 12, color: theme.textSub }}>day streak</div>
                    </div>
                  )}
                  {points.nextRank && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{points.nextRank}</div>
                      <div style={{ fontSize: 12, color: theme.textSub }}>
                        {(points.nextThreshold || 0) - points.totalPoints} pts to go
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timeframe toggle + info button */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
              <button
                onClick={() => setLbTimeframe("alltime")}
                style={{
                  ...btnStyle,
                  background: lbTimeframe === "alltime" ? theme.accent : "transparent",
                  color: lbTimeframe === "alltime" ? "#fff" : theme.textSub,
                  border: `1px solid ${theme.cardBorder}`,
                  padding: "6px 16px",
                  fontSize: 13,
                }}
              >
                All Time
              </button>
              <button
                onClick={() => setLbTimeframe("weekly")}
                style={{
                  ...btnStyle,
                  background: lbTimeframe === "weekly" ? theme.accent : "transparent",
                  color: lbTimeframe === "weekly" ? "#fff" : theme.textSub,
                  border: `1px solid ${theme.cardBorder}`,
                  padding: "6px 16px",
                  fontSize: 13,
                }}
              >
                This Week
              </button>
              <button
                onClick={() => setShowPointsInfo(true)}
                title="How points work"
                style={{
                  marginLeft: "auto",
                  width: 28, height: 28,
                  borderRadius: "50%",
                  border: `1px solid ${theme.cardBorder}`,
                  background: "transparent",
                  color: theme.textSub,
                  fontSize: 15,
                  fontWeight: 700,
                  fontStyle: "italic",
                  fontFamily: "serif",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                i
              </button>
            </div>

            {/* Points info modal */}
            {showPointsInfo && (
              <div
                onClick={() => setShowPointsInfo(false)}
                style={{
                  position: "fixed", inset: 0, zIndex: 1000,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: theme.bg, color: theme.text,
                    borderRadius: 12, padding: "24px 28px",
                    maxWidth: 420, width: "90%",
                    border: `1px solid ${theme.cardBorder}`,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>How Points Work</span>
                    <button
                      onClick={() => setShowPointsInfo(false)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, fontSize: 18, lineHeight: 1 }}
                    >&times;</button>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
                        <th style={{ textAlign: "left", padding: "6px 0", fontWeight: 600, color: theme.textSub }}>Action</th>
                        <th style={{ textAlign: "right", padding: "6px 0", fontWeight: 600, color: theme.textSub }}>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Publish an exercise", "+5"],
                        ["Complete (beginner)", "+10"],
                        ["Complete (intermediate)", "+15"],
                        ["Complete (advanced)", "+25"],
                        ["Complete (expert)", "+40"],
                        ["Vote on an exercise", "+1"],
                        ["Receive an upvote", "+3"],
                        ["Receive a downvote", "-1"],
                      ].map(([action, pts]) => (
                        <tr key={action} style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
                          <td style={{ padding: "8px 0" }}>{action}</td>
                          <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600, color: pts.startsWith("-") ? "#d97706" : "#16a34a" }}>{pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 16, fontSize: 13, color: theme.textSub, lineHeight: 1.5 }}>
                    Exercise difficulty is inferred from the completion rate after 5 attempts. Daily activity maintains your streak.
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard table */}
            <div style={cardStyle}>
              {leaderboard.length === 0 ? (
                <div style={{ textAlign: "center", padding: 24, color: theme.textMuted }}>
                  No entries yet
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
                      <th style={{ textAlign: "left", padding: "8px 4px", fontSize: 12, fontWeight: 600, color: theme.textSub }}>#</th>
                      <th style={{ textAlign: "left", padding: "8px 4px", fontSize: 12, fontWeight: 600, color: theme.textSub }}>User</th>
                      <th style={{ textAlign: "left", padding: "8px 4px", fontSize: 12, fontWeight: 600, color: theme.textSub }}>Rank</th>
                      <th style={{ textAlign: "right", padding: "8px 4px", fontSize: 12, fontWeight: 600, color: theme.textSub }}>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row, i) => (
                      <tr key={row.userId} style={{
                        borderBottom: `1px solid ${theme.cardBorder}`,
                        background: row.userId === user?.id ? (dk ? "#2a2a40" : "#f0f0ff") : "transparent",
                      }}>
                        <td style={{ padding: "10px 4px", fontSize: 14, fontWeight: i < 3 ? 700 : 400 }}>
                          {i + 1}
                        </td>
                        <td style={{ padding: "10px 4px", fontSize: 14, fontWeight: row.userId === user?.id ? 700 : 400 }}>
                          {row.displayName}
                        </td>
                        <td style={{ padding: "10px 4px", fontSize: 13, color: theme.textSub }}>
                          {row.rankTitle}
                        </td>
                        <td style={{ padding: "10px 4px", fontSize: 14, fontWeight: 600, textAlign: "right" }}>
                          {row.totalPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Sparse leaderboard encouragement */}
            {leaderboard.length > 0 && leaderboard.length < 5 && (
              <div style={{ textAlign: "center", padding: "12px 0 4px", fontSize: 13, color: theme.textMuted, lineHeight: 1.5 }}>
                The leaderboard is just getting started. Complete exercises and create content to claim your spot.
              </div>
            )}

            {/* Rank ladder */}
            <div style={{ ...cardStyle, marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Rank Ladder</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {([
                  [0, "Motif"], [25, "Phrase"], [75, "Period"], [150, "Canon"],
                  [300, "Invention"], [500, "Chorale"], [800, "Prelude"], [1200, "Sonata"],
                  [1800, "Fugue"], [2500, "Suite"], [3500, "Concerto"], [5000, "Requiem"],
                  [7500, "Oratorio"], [10000, "Symphony"], [15000, "Opus"],
                ] as [number, string][]).map(([threshold, rank], i, arr) => {
                  const isCurrentRank = points?.rankTitle === rank;
                  const isReached = points ? points.totalPoints >= threshold : false;
                  return (
                    <div key={rank} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "5px 8px",
                      borderRadius: 6,
                      background: isCurrentRank ? (dk ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)") : "transparent",
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: isReached ? "#16a34a" : (dk ? "#444" : "#ddd"),
                        flexShrink: 0,
                      }} />
                      <span style={{
                        fontSize: 13,
                        fontWeight: isCurrentRank ? 700 : 400,
                        color: isReached ? theme.text : theme.textMuted,
                        flex: 1,
                      }}>
                        {rank}
                      </span>
                      <span style={{
                        fontSize: 11,
                        color: theme.textMuted,
                      }}>
                        {threshold === 0 ? "0" : threshold.toLocaleString()} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
      )}

      {/* Create/Edit Tab — editor takes most of the screen, form in a sidebar */}
      {tab === "create" && (<>
        <style>{`
          .create-layout { display: flex; flex: 1; min-height: 0; position: relative; }
          .create-sidebar { width: 320px; min-width: 280px; max-width: 360px; flex-shrink: 0; }
          @media (max-width: 768px) {
            .create-layout { flex-direction: column; }
            .create-sidebar { width: 100% !important; max-width: 100% !important; min-width: 0 !important; border-right: none !important; border-bottom: 1px solid var(--border); }
          }
        `}</style>
        <div className="create-layout" style={{ "--border": theme.cardBorder } as React.CSSProperties}>
          {/* Form sidebar */}
          <div className="create-sidebar" style={{
            padding: "0 16px 80px", overflowY: "auto",
            borderRight: `1px solid ${theme.cardBorder}`,
            background: theme.bg, zIndex: 10, position: "relative",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 16px" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{editingExercise ? "Edit Exercise" : "New Exercise"}</h2>
              {editingExercise && (
                <button onClick={handleCancelEdit} style={{ ...btnStyle, padding: "3px 10px", fontSize: 11, background: "transparent", color: theme.textSub, border: `1px solid ${theme.cardBorder}` }}>
                  Cancel
                </button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: "block" }}>Title *</label>
                <input style={inputStyle} value={createTitle} onChange={e => setCreateTitle(e.target.value)} placeholder="e.g. I-IV-V-I Cadence" />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: "block" }}>Description</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={createDesc} onChange={e => setCreateDesc(e.target.value)} placeholder="Describe the exercise..." />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: "block" }}>Template</label>
                <select style={inputStyle} value={createTemplate} onChange={e => {
                  setCreateTemplate(e.target.value);
                  if (e.target.value === "species_counterpoint") setCreateScale("none");
                  else if (createScale === "none") setCreateScale("major");
                }}>
                  {TEMPLATES.map(t => <option key={t} value={t}>{TEMPLATE_LABELS[t]}</option>)}
                </select>
              </div>

              {createTemplate === "species_counterpoint" ? (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: "block" }}>Tonic</label>
                  <select style={inputStyle} value={createTonicIdx} onChange={e => setCreateTonicIdx(Number(e.target.value))}>
                    {TONIC_LABELS.map((n, i) => <option key={i} value={i}>{n}</option>)}
                  </select>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: "block" }}>Key</label>
                    <select style={inputStyle} value={createTonicIdx} onChange={e => setCreateTonicIdx(Number(e.target.value))}>
                      {TONIC_LABELS.map((n, i) => <option key={i} value={i}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: "block" }}>Scale</label>
                    <select style={inputStyle} value={createScale} onChange={e => setCreateScale(e.target.value)}>
                      {SCALE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: "block" }}>Beats/bar</label>
                  <select style={inputStyle} value={createTsTop} onChange={e => setCreateTsTop(Number(e.target.value))}>
                    {[2, 3, 4, 6, 9, 12].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: "block" }}>Beat value</label>
                  <select style={inputStyle} value={createTsBottom} onChange={e => setCreateTsBottom(Number(e.target.value))}>
                    {[2, 4, 8].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              {createTemplate === "species_counterpoint" && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: "block" }}>CF Voice</label>
                  <div style={{ display: "flex", gap: 12 }}>
                    {(["bass", "soprano"] as const).map(v => (
                      <label key={v} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
                        <input type="radio" name="cfVoice" value={v} checked={createCfVoice === v} onChange={() => setCreateCfVoice(v)} />
                        {v === "bass" ? "Bass" : "Soprano"}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, display: "block" }}>Tags</label>
                <input style={inputStyle} value={createTags} onChange={e => setCreateTags(e.target.value)} placeholder="comma-separated" />
              </div>

              {createError && (
                <div style={{ fontSize: 12, color: "#dc2626", padding: "6px 10px", background: dk ? "#3a1a1a" : "#fde8e8", borderRadius: 6 }}>
                  {createError}
                </div>
              )}

              <button onClick={editingExercise ? handleUpdate : handleCreate} disabled={creating} style={{ ...btnStyle, opacity: creating ? 0.6 : 1, width: "100%" }}>
                {creating ? (editingExercise ? "Saving..." : "Creating...") : (editingExercise ? "Save Changes" : "Create Draft")}
              </button>
            </div>
          </div>

          {/* Editor — takes remaining space */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <NoteEditor
              key={`${editingExercise?.id ?? "new"}-${createTemplate}`}
              lessonConfig={createLessonConfig}
              initialTonicIdx={createTonicIdx}
              initialScaleName={createScale}
              initialTsTop={createTsTop}
              initialTsBottom={createTsBottom}
              initialTrebleBeats={editingExercise?.sopranoBeats || undefined}
              initialBassBeats={editingExercise?.bassBeats || undefined}
              onTrebleBeatsChanged={handleTrebleChanged}
              onBassBeatsChanged={handleBassChanged}
            />
          </div>
        </div>
      </>)}


    </div>
  );
}

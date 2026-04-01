import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, API_BASE } from "../auth";
import { NoteEditor } from "./staff";

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
const TEMPLATES = ["harmonize_melody", "rn_analysis"];
const TEMPLATE_LABELS: Record<string, string> = {
  harmonize_melody: "Harmonize Melody",
  rn_analysis: "Roman Numeral Analysis",
};
const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "#16a34a",
  intermediate: "#d97706",
  advanced: "#dc2626",
  unknown: "#888",
};

const NOTE_NAMES = ["C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B", "Cb", "B#"];

export function CommunityPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [darkMode] = useState(() => {
    try { return localStorage.getItem("contrapunctus_dark") === "true"; } catch { return false; }
  });
  const dk = darkMode;

  const [tab, setTab] = useState<Tab>("browse");
  const [exercises, setExercises] = useState<CommunityExercise[]>([]);
  const [myExercises, setMyExercises] = useState<CommunityExercise[]>([]);
  const [points, setPoints] = useState<PointsSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [lbTimeframe, setLbTimeframe] = useState<"alltime" | "weekly">("alltime");
  const [loading, setLoading] = useState(true);

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

  // Bug report
  const [bugOpen, setBugOpen] = useState(false);
  const [bugDesc, setBugDesc] = useState("");
  const [bugStatus, setBugStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [showEditor, setShowEditor] = useState(false);
  const [editorBeats, setEditorBeats] = useState<any>(null);
  const editorBeatsRef = useRef(editorBeats);
  editorBeatsRef.current = editorBeats;

  const handleTrebleChanged = useCallback((treble: any) => {
    setEditorBeats({ ...editorBeatsRef.current, sopranoBeats: treble });
  }, []);

  const handleBassChanged = useCallback((bass: any) => {
    setEditorBeats({ ...editorBeatsRef.current, bassBeats: bass });
  }, []);

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
    inputBg: dk ? "#1a1a1e" : "#f5f3f0",
    inputBorder: dk ? "#444" : "#ccc",
  };

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

  const handleCreate = async () => {
    if (!createTitle.trim()) { setCreateError("Title is required"); return; }
    setCreating(true);
    setCreateError("");
    try {
      const body: any = {
        title: createTitle.trim(),
        description: createDesc.trim(),
        template: createTemplate,
        tonicIdx: createTonicIdx,
        scaleName: createScale,
        tsTop: createTsTop,
        tsBottom: createTsBottom,
        sopranoBeats: editorBeats?.sopranoBeats || [],
        bassBeats: editorBeats?.bassBeats || null,
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
      setShowEditor(false);
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

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this exercise?")) return;
    await fetch(`${API_BASE}/api/community/exercises/${id}`, {
      method: "DELETE",
      headers,
    });
    setMyExercises(prev => prev.filter(e => e.id !== id));
    setExercises(prev => prev.filter(e => e.id !== id));
  };

  const handleBugReport = async () => {
    if (!token || !bugDesc.trim()) return;
    setBugStatus("sending");
    try {
      const res = await fetch(`${API_BASE}/api/bug-reports`, {
        method: "POST",
        headers,
        body: JSON.stringify({ description: bugDesc, stateJson: { page: "community" } }),
      });
      if (res.ok) {
        setBugStatus("sent");
        setTimeout(() => { setBugOpen(false); setBugDesc(""); setBugStatus("idle"); }, 1500);
      } else {
        setBugStatus("error");
      }
    } catch {
      setBugStatus("error");
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
    background: theme.inputBg,
    border: `1px solid ${theme.inputBorder}`,
    borderRadius: 8,
    color: theme.text,
    fontFamily: "inherit",
    boxSizing: "border-box",
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
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: dk ? "#333" : "#f0ede9", color: theme.textSub }}>
              {TEMPLATE_LABELS[ex.template] || ex.template}
            </span>
            <span style={{ fontSize: 12, color: theme.textSub }}>
              {NOTE_NAMES[ex.tonicIdx]} {ex.scaleName}
            </span>
            <span style={{ fontSize: 12, color: theme.textSub }}>
              {ex.tsTop}/{ex.tsBottom}
            </span>
            <span style={{ fontSize: 12, color: DIFFICULTY_COLORS[ex.inferredDifficulty] || "#888" }}>
              {ex.inferredDifficulty}
            </span>
            {ex.tags.length > 0 && ex.tags.map(tag => (
              <span key={tag} style={{ fontSize: 11, padding: "1px 6px", borderRadius: 3, background: dk ? "#3a3a50" : "#e8e4f0", color: dk ? "#aab" : "#555" }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, minWidth: 80 }}>
          <div style={{ display: "flex", gap: 8, fontSize: 13, color: theme.textSub }}>
            <span title="Upvotes">+{ex.upvotes}</span>
            <span title="Downvotes">-{ex.downvotes}</span>
          </div>
          <div style={{ fontSize: 12, color: theme.textMuted }}>
            {ex.attemptCount} attempt{ex.attemptCount !== 1 ? "s" : ""}
          </div>
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
            {ex.status}
          </span>
          {ex.status === "draft" && (
            <button onClick={() => handlePublish(ex.id)} style={{ ...btnStyle, padding: "3px 12px", fontSize: 12 }}>
              Publish
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Link to="/" style={{ fontSize: 13, color: theme.textMuted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 16 }}>&larr;</span> Home
          </Link>
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

      {/* Content */}
      <div style={{ maxWidth: 800, margin: "0 auto", width: "100%", padding: "0 24px 80px" }}>
        {loading && tab === "browse" && (
          <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>Loading...</div>
        )}

        {/* Browse Tab */}
        {tab === "browse" && !loading && (
          <>
            {exercises.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>
                No exercises published yet. Be the first to create one!
              </div>
            ) : (
              exercises.map(ex => renderExerciseCard(ex))
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

        {/* Create Tab */}
        {tab === "create" && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>New Exercise</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>Title *</label>
                <input style={inputStyle} value={createTitle} onChange={e => setCreateTitle(e.target.value)} placeholder="e.g. I-IV-V-I Cadence in C Major" />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>Description</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={createDesc} onChange={e => setCreateDesc(e.target.value)} placeholder="Describe the exercise..." />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>Template</label>
                  <select style={inputStyle} value={createTemplate} onChange={e => setCreateTemplate(e.target.value)}>
                    {TEMPLATES.map(t => <option key={t} value={t}>{TEMPLATE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>Scale</label>
                  <select style={inputStyle} value={createScale} onChange={e => setCreateScale(e.target.value)}>
                    {SCALE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>Key</label>
                  <select style={inputStyle} value={createTonicIdx} onChange={e => setCreateTonicIdx(Number(e.target.value))}>
                    {NOTE_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>Beats per bar</label>
                  <select style={inputStyle} value={createTsTop} onChange={e => setCreateTsTop(Number(e.target.value))}>
                    {[2, 3, 4, 6, 9, 12].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>Beat value</label>
                  <select style={inputStyle} value={createTsBottom} onChange={e => setCreateTsBottom(Number(e.target.value))}>
                    {[2, 4, 8].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>Tags (comma-separated)</label>
                <input style={inputStyle} value={createTags} onChange={e => setCreateTags(e.target.value)} placeholder="e.g. cadences, beginner, four-part" />
              </div>

              <p style={{ fontSize: 13, color: theme.textSub, margin: 0 }}>
                Use the editor below to compose the soprano melody (and optionally bass line) for your exercise.
                After creating the exercise as a draft, you can publish it when ready.
              </p>

              {createError && (
                <div style={{ fontSize: 13, color: "#dc2626", padding: "8px 12px", background: dk ? "#3a1a1a" : "#fde8e8", borderRadius: 6 }}>
                  {createError}
                </div>
              )}

              <div style={{ display: "flex", gap: 12 }}>
                {!showEditor && (
                  <button onClick={() => setShowEditor(true)} style={btnStyle}>
                    Open Editor
                  </button>
                )}
                <button onClick={handleCreate} disabled={creating} style={{ ...btnStyle, opacity: creating ? 0.6 : 1 }}>
                  {creating ? "Creating..." : "Create Draft"}
                </button>
              </div>
            </div>
          </div>
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

            {/* Timeframe toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
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
            </div>

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
          </>
        )}
      </div>

      {/* Editor outside constrained container so it gets full width */}
      {tab === "create" && showEditor && (
        <NoteEditor
          initialTonicIdx={createTonicIdx}
          initialScaleName={createScale}
          initialTsTop={createTsTop}
          initialTsBottom={createTsBottom}
          onTrebleBeatsChanged={handleTrebleChanged}
          onBassBeatsChanged={handleBassChanged}
        />
      )}

      {/* Footer — hidden when editor is open since the editor has its own toolbar */}
      {!(tab === "create" && showEditor) && <>
      <div style={{ marginTop: "auto" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: theme.footerBg, borderTop: `1px solid ${theme.footerBorder}`,
        padding: "16px 24px", color: theme.text,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 800, margin: "0 auto" }}>
          <span style={{ fontSize: 13, opacity: 0.6 }}>{user?.displayName}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setBugOpen(true)} style={{
              padding: 0, fontSize: 12, background: "none", border: "none",
              opacity: 0.6, color: "inherit", cursor: "pointer",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              textDecoration: "underline", textUnderlineOffset: 2,
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}
            >
              Report a bug
            </button>
            <button onClick={logout} style={{
              padding: 0, fontSize: 12, background: "none", border: "none",
              opacity: 0.6, color: "inherit", cursor: "pointer",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              textDecoration: "underline", textUnderlineOffset: 2,
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
      </>}

      {/* Bug report modal */}
      {bugOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => { setBugOpen(false); setBugStatus("idle"); }}>
          <div style={{
            background: theme.cardBg, borderRadius: 12, padding: 24,
            width: "100%", maxWidth: 440, margin: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            color: theme.text,
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Report a Bug</h3>
            <textarea
              style={{
                width: "100%", minHeight: 100, padding: "10px 12px", fontSize: 14,
                background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
                borderRadius: 8, color: theme.text, fontFamily: "inherit",
                boxSizing: "border-box", resize: "vertical",
              }}
              placeholder="Describe what went wrong..."
              value={bugDesc}
              onChange={e => setBugDesc(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button onClick={() => { setBugOpen(false); setBugStatus("idle"); }} style={{
                ...btnStyle, background: "transparent", color: theme.textSub,
                border: `1px solid ${theme.cardBorder}`,
              }}>
                Cancel
              </button>
              <button onClick={handleBugReport} disabled={bugStatus === "sending" || bugStatus === "sent"} style={{
                ...btnStyle, opacity: bugStatus === "sending" ? 0.6 : 1,
              }}>
                {bugStatus === "idle" ? "Send" : bugStatus === "sending" ? "Sending..." : bugStatus === "sent" ? "Sent!" : "Error — retry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

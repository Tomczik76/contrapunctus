import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth, API_BASE } from "../auth";
import { NoteEditor, type PlacedBeat, type LessonConfig } from "./staff";
import { useTheme } from "../useTheme";
import { TONIC_LABELS } from "../constants";

interface EducatorLesson {
  id: string;
  educatorId: string;
  title: string;
  description: string;
  difficulty: string;
  template: string;
  tonicIdx: number;
  scaleName: string;
  tsTop: number;
  tsBottom: number;
  sopranoBeats: PlacedBeat[];
  bassBeats: PlacedBeat[] | null;
  figuredBass: string[][] | null;
  createdAt: string;
}

interface ClassItem {
  id: string;
  name: string;
}

export function EducatorLessonEditor() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const theme = useTheme();
  const isEdit = !!lessonId;

  const [loading, setLoading] = useState(isEdit);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("beginner");
  const [template, setTemplate] = useState("harmonize_melody");
  const [tonicIdx, setTonicIdx] = useState(0);
  const [scaleName, setScaleName] = useState("major");
  const [tsTop, setTsTop] = useState(4);
  const [tsBottom, setTsBottom] = useState(4);
  const [sopranoBeats, setSopranoBeats] = useState<PlacedBeat[]>([]);
  const [bassBeats, setBassBeats] = useState<PlacedBeat[]>([]);
  const [figuredBass, setFiguredBass] = useState<string[][]>([]);
  const [editorKey, setEditorKey] = useState(0);
  const [bassEditorKey, setBassEditorKey] = useState(100);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Class assignment
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignClassIds, setAssignClassIds] = useState<string[]>([]);
  const [showAssign, setShowAssign] = useState(false);

  const isFiguredBass = template === "figured_bass";
  const isRomanNumeral = template === "roman_numeral_analysis";

  useEffect(() => {
    if (!isEdit) return;
    fetch(`${API_BASE}/api/educator/lessons/${lessonId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: EducatorLesson) => {
        setTitle(data.title);
        setDescription(data.description);
        setDifficulty(data.difficulty);
        setTemplate(data.template);
        setTonicIdx(data.tonicIdx);
        setScaleName(data.scaleName);
        setTsTop(data.tsTop);
        setTsBottom(data.tsBottom);
        setSopranoBeats(data.sopranoBeats ?? []);
        setBassBeats(data.bassBeats ?? []);
        setFiguredBass(data.figuredBass ?? []);
        setEditorKey(k => k + 1);
        setBassEditorKey(k => k + 1);
        setLoading(false);
      })
      .catch(() => navigate("/educator/lessons", { replace: true }));
  }, [isEdit, lessonId, token, navigate]);

  // Fetch classes for assignment
  useEffect(() => {
    fetch(`${API_BASE}/api/educator/classes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: Array<{ id: string; name: string; status: string }>) => {
        setClasses(data.filter(c => c.status === "active").map(c => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
  }, [token]);

  const handleTrebleBeatsChanged = useCallback((beats: PlacedBeat[]) => {
    setSopranoBeats(beats);
  }, []);

  const handleBassBeatsChanged = useCallback((beats: PlacedBeat[]) => {
    setBassBeats(beats);
  }, []);

  async function handleSave() {
    if (!title.trim()) { setError("Title is required"); return; }
    if (!description.trim()) { setError("Description is required"); return; }

    if (isFiguredBass) {
      const validBass = bassBeats.filter(b => !b.isRest && b.notes.length > 0);
      if (validBass.length === 0) { setError("Write at least one note for the bass line"); return; }
    } else if (isRomanNumeral) {
      const validTreble = sopranoBeats.filter(b => !b.isRest && b.notes.length > 0);
      const validBass = bassBeats.filter(b => !b.isRest && b.notes.length > 0);
      if (validTreble.length === 0 && validBass.length === 0) { setError("Write music on both staves"); return; }
    } else {
      const validBeats = sopranoBeats.filter(b => !b.isRest && b.notes.length > 0);
      if (validBeats.length === 0) { setError("Write at least one note for the soprano melody"); return; }
    }

    setSaving(true);
    setError("");

    const body: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      difficulty,
      template,
      tonicIdx,
      scaleName,
      tsTop,
      tsBottom,
      sopranoBeats: isFiguredBass ? [] : sopranoBeats,
      bassBeats: (isFiguredBass || isRomanNumeral) ? bassBeats : null,
      figuredBass: isFiguredBass ? figuredBass : null,
    };

    const url = isEdit
      ? `${API_BASE}/api/educator/lessons/${lessonId}`
      : `${API_BASE}/api/educator/lessons`;

    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save");
      setSaving(false);
      return;
    }

    const saved = await res.json();

    // Assign to selected classes
    if (assignClassIds.length > 0) {
      await Promise.all(
        assignClassIds.map(classId =>
          fetch(`${API_BASE}/api/educator/classes/${classId}/lessons`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lessonId: saved.id }),
          })
        )
      );
    }

    setSaving(false);
    navigate("/educator/lessons");
  }

  async function handleDuplicate() {
    if (!lessonId) return;
    setSaving(true);
    const res = await fetch(`${API_BASE}/api/educator/lessons/${lessonId}/duplicate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSaving(false);
    if (res.ok) {
      const dup = await res.json();
      navigate(`/educator/lessons/${dup.id}/edit`);
    }
  }

  function toggleClassAssignment(classId: string) {
    setAssignClassIds(prev =>
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: theme.bg, color: theme.textMuted, fontSize: 14 }}>
        Loading lesson...
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: 8, fontSize: 13,
    border: `1px solid ${theme.cardBorder}`, borderRadius: 4, boxSizing: "border-box",
    background: theme.inputBg, color: theme.text, fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block", color: theme.text,
  };

  // Preview mode — render a read-only NoteEditor with lessonConfig
  if (previewMode) {
    const lessonConfig: LessonConfig = {
      lockedTrebleBeats: isFiguredBass ? [] : sopranoBeats,
      lockedBassBeats: (isFiguredBass || isRomanNumeral) ? bassBeats : undefined,
      figuredBass: isFiguredBass ? figuredBass : undefined,
      tonicIdx,
      scaleName,
      tsTop,
      tsBottom,
      checked: false,
    };

    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <NoteEditor
          key="preview"
          lessonConfig={lessonConfig}
          initialTonicIdx={tonicIdx}
          initialScaleName={scaleName}
          initialTsTop={tsTop}
          initialTsBottom={tsBottom}
          header={
            <>
              {/* Lesson info */}
              <div style={{ padding: "10px 16px", borderBottom: `1px solid ${theme.cardBorder}` }}>
                <div style={{ fontSize: 13, color: theme.textSub, marginBottom: 2 }}>{description}</div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                  background: theme.badgeBg, color: theme.textMuted,
                }}>
                  {difficulty}
                </span>
              </div>
              {/* Nav bar */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <button
                    onClick={() => setPreviewMode(false)}
                    style={{
                      fontSize: 13, color: theme.textMuted,
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>&larr;</span> Back to Editor
                  </button>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, textAlign: "center", whiteSpace: "nowrap" }}>
                  {title || "Untitled Lesson"}
                </span>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 12, opacity: 0.5 }}>Student Preview</span>
                </div>
              </div>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: theme.bg, color: theme.text }}>
      {/* Header */}
      <header style={{
        borderBottom: `1px solid ${theme.sidebarBorder}`,
        background: theme.sidebarBg,
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link to="/educator/lessons" style={{
            fontSize: 13, color: theme.textMuted, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <span style={{ fontSize: 16 }}>&larr;</span> Lessons
          </Link>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>
            {isEdit ? "Edit Lesson" : "Create Lesson"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isEdit && (
            <button
              onClick={handleDuplicate}
              disabled={saving}
              style={{
                padding: "8px 14px", fontSize: 13,
                color: theme.textMuted, background: "none",
                border: `1px solid ${theme.cardBorder}`, borderRadius: 6,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Duplicate
            </button>
          )}
          <button
            onClick={() => setPreviewMode(true)}
            style={{
              padding: "8px 14px", fontSize: 13,
              color: theme.textMuted, background: "none",
              border: `1px solid ${theme.cardBorder}`, borderRadius: 6,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Preview as Student
          </button>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, padding: "24px 40px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        {error && <div style={{ color: "#c00", fontSize: 13, marginBottom: 12, padding: "8px 12px", background: "rgba(220,0,0,0.08)", borderRadius: 6 }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Template */}
          <div>
            <label style={labelStyle}>Template</label>
            <select value={template} onChange={e => setTemplate(e.target.value)} style={inputStyle}>
              <option value="harmonize_melody">Harmonize a Melody</option>
              <option value="figured_bass">Figured Bass</option>
              <option value="roman_numeral_analysis">Roman Numeral Analysis</option>
            </select>
          </div>

          {/* Title + Description */}
          <div>
            <label style={labelStyle}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="e.g. Harmonize a Melody in G Major" />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder="Instructions for the student..." />
          </div>

          {/* Key & Scale */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Key</label>
              <select value={tonicIdx} onChange={e => setTonicIdx(Number(e.target.value))} style={inputStyle}>
                {TONIC_LABELS.map((label, i) => (
                  <option key={i} value={i}>{label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Scale</label>
              <select value={scaleName} onChange={e => setScaleName(e.target.value)} style={inputStyle}>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
              </select>
            </div>
          </div>

          {/* Time Signature */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Time Sig Top</label>
              <input type="number" value={tsTop} onChange={e => setTsTop(Number(e.target.value))} style={inputStyle} min={1} max={12} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Time Sig Bottom</label>
              <select value={tsBottom} onChange={e => setTsBottom(Number(e.target.value))} style={inputStyle}>
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={8}>8</option>
              </select>
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label style={labelStyle}>Difficulty</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={inputStyle}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          {/* Soprano Melody Editor (harmonize_melody) */}
          {!isFiguredBass && !isRomanNumeral && (
            <div>
              <label style={labelStyle}>Soprano Melody</label>
              <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>
                Write the soprano melody on the treble staff below. Only treble notes will be used.
                {sopranoBeats.filter(b => !b.isRest && b.notes.length > 0).length > 0 && (
                  <span style={{ marginLeft: 8, color: theme.text, fontWeight: 600 }}>
                    {sopranoBeats.filter(b => !b.isRest && b.notes.length > 0).length} beats
                  </span>
                )}
              </div>
              <div style={{
                border: `1px solid ${theme.cardBorder}`, borderRadius: 6, overflow: "hidden",
                height: 700, position: "relative",
              }}>
                <NoteEditor
                  key={editorKey}
                  onTrebleBeatsChanged={handleTrebleBeatsChanged}
                  initialTonicIdx={tonicIdx}
                  initialScaleName={scaleName}
                  initialTsTop={tsTop}
                  initialTsBottom={tsBottom}
                  initialTrebleBeats={sopranoBeats.length > 0 ? sopranoBeats : undefined}
                />
              </div>
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => setShowJson(!showJson)}
                  style={{ padding: "3px 8px", fontSize: 11, background: "none", border: `1px solid ${theme.cardBorder}`, borderRadius: 3, cursor: "pointer", color: theme.textMuted }}
                >
                  {showJson ? "Hide" : "Show"} JSON
                </button>
                {showJson && (
                  <pre style={{
                    marginTop: 6, padding: 10, background: theme.badgeBg, borderRadius: 4,
                    fontSize: 11, fontFamily: "monospace", maxHeight: 200, overflow: "auto",
                    border: `1px solid ${theme.cardBorder}`, color: theme.text,
                  }}>
                    {JSON.stringify(sopranoBeats, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Bass Line + Figured Bass */}
          {isFiguredBass && (
            <div>
              <label style={labelStyle}>Bass Line</label>
              <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8, lineHeight: 1.6 }}>
                Write the bass line on the bass staff below. An input box appears under each note for figured bass numbers.
                Enter numbers separated by commas (e.g. <strong>6,4</strong> for <sup>6</sup><sub>4</sub>).
                Leave empty for root position.
              </div>
              <div style={{
                border: `1px solid ${theme.cardBorder}`, borderRadius: 6, overflow: "hidden",
                height: 700, position: "relative",
              }}>
                <NoteEditor
                  key={bassEditorKey}
                  onBassBeatsChanged={handleBassBeatsChanged}
                  figuredBassValues={figuredBass}
                  onFiguredBassChanged={setFiguredBass}
                  initialTonicIdx={tonicIdx}
                  initialScaleName={scaleName}
                  initialTsTop={tsTop}
                  initialTsBottom={tsBottom}
                  initialBassBeats={bassBeats.length > 0 ? bassBeats : undefined}
                />
              </div>
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => setShowJson(!showJson)}
                  style={{ padding: "3px 8px", fontSize: 11, background: "none", border: `1px solid ${theme.cardBorder}`, borderRadius: 3, cursor: "pointer", color: theme.textMuted }}
                >
                  {showJson ? "Hide" : "Show"} JSON
                </button>
                {showJson && (
                  <pre style={{
                    marginTop: 6, padding: 10, background: theme.badgeBg, borderRadius: 4,
                    fontSize: 11, fontFamily: "monospace", maxHeight: 200, overflow: "auto",
                    border: `1px solid ${theme.cardBorder}`, color: theme.text,
                  }}>
                    {JSON.stringify({ bassBeats, figuredBass }, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* SATB Editor (roman_numeral_analysis) */}
          {isRomanNumeral && (
            <div>
              <label style={labelStyle}>Complete SATB Music</label>
              <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8, lineHeight: 1.6 }}>
                Write soprano + alto on the treble staff, tenor + bass on the bass staff.
                Students will see all music locked and must enter roman numeral analysis only.
              </div>
              <div style={{
                border: `1px solid ${theme.cardBorder}`, borderRadius: 6, overflow: "hidden",
                height: 700, position: "relative",
              }}>
                <NoteEditor
                  key={editorKey}
                  onTrebleBeatsChanged={handleTrebleBeatsChanged}
                  onBassBeatsChanged={handleBassBeatsChanged}
                  initialTonicIdx={tonicIdx}
                  initialScaleName={scaleName}
                  initialTsTop={tsTop}
                  initialTsBottom={tsBottom}
                  initialTrebleBeats={sopranoBeats.length > 0 ? sopranoBeats : undefined}
                  initialBassBeats={bassBeats.length > 0 ? bassBeats : undefined}
                />
              </div>
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => setShowJson(!showJson)}
                  style={{ padding: "3px 8px", fontSize: 11, background: "none", border: `1px solid ${theme.cardBorder}`, borderRadius: 3, cursor: "pointer", color: theme.textMuted }}
                >
                  {showJson ? "Hide" : "Show"} JSON
                </button>
                {showJson && (
                  <pre style={{
                    marginTop: 6, padding: 10, background: theme.badgeBg, borderRadius: 4,
                    fontSize: 11, fontFamily: "monospace", maxHeight: 200, overflow: "auto",
                    border: `1px solid ${theme.cardBorder}`, color: theme.text,
                  }}>
                    {JSON.stringify({ sopranoBeats, bassBeats }, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Assign to classes */}
          {!isEdit && classes.length > 0 && (
            <div>
              <label style={labelStyle}>Assign to Classes (optional)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {classes.map(cls => (
                  <button
                    key={cls.id}
                    onClick={() => toggleClassAssignment(cls.id)}
                    style={{
                      padding: "6px 14px", fontSize: 13,
                      borderRadius: 20,
                      border: `1px solid ${assignClassIds.includes(cls.id) ? theme.successText : theme.cardBorder}`,
                      background: assignClassIds.includes(cls.id) ? (theme.dk ? "rgba(22,163,74,0.15)" : "rgba(22,163,74,0.08)") : theme.badgeBg,
                      color: assignClassIds.includes(cls.id) ? theme.successText : theme.text,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontWeight: assignClassIds.includes(cls.id) ? 600 : 400,
                    }}
                  >
                    {assignClassIds.includes(cls.id) ? "\u2713 " : ""}{cls.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isEdit && classes.length > 0 && (
            <div>
              <button
                onClick={() => setShowAssign(!showAssign)}
                style={{
                  padding: "6px 14px", fontSize: 13,
                  color: theme.textMuted, background: "none",
                  border: `1px solid ${theme.cardBorder}`, borderRadius: 6,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {showAssign ? "Hide" : "Assign to Classes"}
              </button>
              {showAssign && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {classes.map(cls => (
                    <button
                      key={cls.id}
                      onClick={() => toggleClassAssignment(cls.id)}
                      style={{
                        padding: "6px 14px", fontSize: 13,
                        borderRadius: 20,
                        border: `1px solid ${assignClassIds.includes(cls.id) ? theme.successText : theme.cardBorder}`,
                        background: assignClassIds.includes(cls.id) ? (theme.dk ? "rgba(22,163,74,0.15)" : "rgba(22,163,74,0.08)") : theme.badgeBg,
                        color: assignClassIds.includes(cls.id) ? theme.successText : theme.text,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: assignClassIds.includes(cls.id) ? 600 : 400,
                      }}
                    >
                      {assignClassIds.includes(cls.id) ? "\u2713 " : ""}{cls.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8, paddingBottom: 40 }}>
            <Link
              to="/educator/lessons"
              style={{
                padding: "8px 16px", fontSize: 13,
                color: theme.textMuted, background: "none",
                border: `1px solid ${theme.cardBorder}`, borderRadius: 4,
                cursor: "pointer", textDecoration: "none",
                display: "inline-flex", alignItems: "center",
              }}
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "8px 16px", fontSize: 13, fontWeight: 600,
                background: theme.btnBg, color: theme.btnText,
                border: "none", borderRadius: 4, cursor: "pointer",
                opacity: saving ? 0.6 : 1,
                fontFamily: "inherit",
              }}
            >
              {saving ? "Saving..." : isEdit ? "Update Lesson" : "Create Lesson"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

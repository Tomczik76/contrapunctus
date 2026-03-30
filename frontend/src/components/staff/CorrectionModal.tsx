import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../../auth";

export type CorrectionCategory = "chord_label" | "nct_detection" | "part_writing_error";

export interface CorrectionLocation {
  measure: number;
  beat: number;
  beatIdx: number;
  voice?: string;
}

export interface SelectedElement {
  location: CorrectionLocation;
  category: CorrectionCategory;
  currentAnalysis: { type: string; displayText: string };
}

/** NCT type abbreviations used by the analysis engine */
const NCT_TYPES = [
  { value: "not_nct", label: "Not an NCT" },
  { value: "PT", label: "Passing Tone" },
  { value: "NT", label: "Neighbor Tone" },
  { value: "SUS", label: "Suspension" },
  { value: "RET", label: "Retardation" },
  { value: "APP", label: "Appoggiatura" },
  { value: "ET", label: "Escape Tone" },
  { value: "ANT", label: "Anticipation" },
  { value: "PED", label: "Pedal Tone" },
  { value: "CT", label: "Changing Tone" },
];

/** Part-writing error types the system detects */
const ERROR_TYPES = [
  { value: "false_positive", label: "False Positive (not an error)" },
  { value: "parallel_fifths", label: "Parallel Fifths" },
  { value: "parallel_octaves", label: "Parallel Octaves" },
  { value: "direct_fifths", label: "Direct/Hidden Fifths" },
  { value: "direct_octaves", label: "Direct/Hidden Octaves" },
  { value: "voice_crossing", label: "Voice Crossing" },
  { value: "spacing_error", label: "Spacing Error" },
  { value: "doubled_leading_tone", label: "Doubled Leading Tone" },
  { value: "unresolved_leading_tone", label: "Unresolved Leading Tone" },
  { value: "unresolved_seventh", label: "Unresolved Chordal 7th" },
];

interface CorrectionModalProps {
  open: boolean;
  onClose: () => void;
  token: string | null;
  dark: boolean;
  isMobile: boolean;
  /** Current state snapshot for debugging */
  stateSnapshot: () => Record<string, unknown>;
  /** Currently selected element from the score (set externally when user clicks) */
  selectedElement: SelectedElement | null;
  /** Clear the selected element */
  clearSelection: () => void;
  /** Enter element selection mode — tells the score to intercept clicks */
  onEnterSelectionMode: (category: CorrectionCategory) => void;
  /** Whether we're currently in selection mode */
  selectionMode: boolean;
}

type SubmitStatus = "idle" | "sending" | "sent" | "error";

export function CorrectionModal({
  open, onClose, token, dark, isMobile,
  stateSnapshot, selectedElement, clearSelection,
  onEnterSelectionMode, selectionMode,
}: CorrectionModalProps) {
  const [tab, setTab] = useState<"general" | "analysis">("analysis");
  const [category, setCategory] = useState<CorrectionCategory | null>(null);
  const [correctionValue, setCorrectionValue] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");

  // General bug report state
  const [generalDesc, setGeneralDesc] = useState("");
  const [generalStatus, setGeneralStatus] = useState<SubmitStatus>("idle");

  // Reset when modal opens/closes
  useEffect(() => {
    if (open) {
      setStatus("idle");
      setGeneralStatus("idle");
      setCorrectionValue("");
      setDescription("");
    }
  }, [open]);

  // When an element is selected, exit selection mode visually
  useEffect(() => {
    if (selectedElement) {
      // Pre-fill correction value based on category
      setCorrectionValue("");
    }
  }, [selectedElement]);

  const handleCategorySelect = (cat: CorrectionCategory) => {
    setCategory(cat);
    clearSelection();
    onEnterSelectionMode(cat);
  };

  const handleSubmitCorrection = async () => {
    if (!token || !selectedElement) return;
    setStatus("sending");
    try {
      const body = {
        category: selectedElement.category,
        measure: selectedElement.location.measure,
        beat: selectedElement.location.beat,
        voice: selectedElement.location.voice || null,
        currentAnalysis: selectedElement.currentAnalysis,
        suggestedCorrection: {
          type: correctionValue,
          displayText: getCorrectionDisplayText(),
        },
        description: description.trim() || null,
        stateSnapshot: stateSnapshot(),
      };
      const res = await fetch(`${API_BASE}/api/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setStatus("sent");
        setTimeout(() => { onClose(); resetState(); }, 1500);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const handleSubmitGeneral = async () => {
    if (!token || !generalDesc.trim()) return;
    setGeneralStatus("sending");
    try {
      const res = await fetch(`${API_BASE}/api/bug-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: generalDesc, stateJson: stateSnapshot() }),
      });
      if (res.ok) {
        setGeneralStatus("sent");
        setTimeout(() => { onClose(); setGeneralDesc(""); setGeneralStatus("idle"); }, 1500);
      } else {
        setGeneralStatus("error");
      }
    } catch {
      setGeneralStatus("error");
    }
  };

  const resetState = () => {
    setCategory(null);
    setCorrectionValue("");
    setDescription("");
    setStatus("idle");
    clearSelection();
  };

  const getCorrectionDisplayText = (): string => {
    if (selectedElement?.category === "chord_label") return correctionValue;
    if (selectedElement?.category === "nct_detection") {
      return NCT_TYPES.find(t => t.value === correctionValue)?.label || correctionValue;
    }
    if (selectedElement?.category === "part_writing_error") {
      return ERROR_TYPES.find(t => t.value === correctionValue)?.label || correctionValue;
    }
    return correctionValue;
  };

  const canSubmitCorrection = selectedElement && correctionValue.trim() && status !== "sending";

  if (!open) return null;

  // Theme
  const bg = dark ? "#2a2a30" : "#fff";
  const textColor = dark ? "#e0ddd8" : "#333";
  const mutedColor = dark ? "#888" : "#666";
  const borderColor = dark ? "#444" : "#ccc";
  const inputBg = dark ? "#32323a" : "#faf9f7";
  const activeBg = dark ? "#3a3a44" : "#eceae6";
  const accentBg = dark ? "#4a4a55" : "#333";
  const accentText = "#fff";

  // If in selection mode, show minimal overlay
  if (selectionMode && !selectedElement) {
    const bannerStyle: React.CSSProperties = isMobile
      ? { position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px 20px", background: bg, borderTop: `2px solid ${dark ? "#5a7" : "#27ae60"}`, zIndex: 1000, boxShadow: "0 -4px 20px rgba(0,0,0,0.15)" }
      : { position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", padding: "12px 24px", background: bg, borderRadius: 8, border: `2px solid ${dark ? "#5a7" : "#27ae60"}`, zIndex: 1000, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" };
    return (
      <div style={bannerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: textColor }}>
          <span style={{ fontSize: 14 }}>
            Click on the {category === "chord_label" ? "Roman numeral" : category === "nct_detection" ? "NCT marker or note" : "error highlight"} that is incorrect
          </span>
          <button
            onClick={() => { clearSelection(); onClose(); resetState(); }}
            style={{ padding: "4px 12px", fontSize: 13, cursor: "pointer", border: `1px solid ${borderColor}`, borderRadius: 4, background: "none", color: textColor }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Full modal
  const modalStyle: React.CSSProperties = isMobile
    ? { position: "fixed", bottom: 0, left: 0, right: 0, background: bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: "20px 16px", maxHeight: "85vh", overflowY: "auto", zIndex: 1001, boxShadow: "0 -4px 20px rgba(0,0,0,0.2)", color: textColor }
    : { background: bg, borderRadius: 8, padding: 24, width: 440, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", color: textColor };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "8px 0", fontSize: 13, fontFamily: "inherit", cursor: "pointer",
    border: "none", borderBottom: active ? `2px solid ${dark ? "#7c9" : "#333"}` : `2px solid transparent`,
    background: "none", color: active ? textColor : mutedColor, fontWeight: active ? 600 : 400,
  });

  const categoryBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "10px 8px", fontSize: 12, fontFamily: "inherit", cursor: "pointer",
    border: `1px solid ${active ? (dark ? "#7c9" : "#333") : borderColor}`,
    borderRadius: 6, background: active ? activeBg : "none", color: textColor,
    fontWeight: active ? 600 : 400, textAlign: "center",
  });

  const submitBtnStyle = (st: SubmitStatus, disabled: boolean): React.CSSProperties => ({
    padding: "8px 20px", fontSize: 13, fontFamily: "inherit", cursor: disabled ? "not-allowed" : "pointer",
    border: `1px solid ${accentBg}`, borderRadius: 4,
    background: st === "sent" ? "#27ae60" : st === "error" ? "#c0392b" : accentBg,
    color: accentText, opacity: disabled ? 0.5 : 1,
  });

  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1000 }}
      onClick={() => { if (status !== "sending" && generalStatus !== "sending") { onClose(); resetState(); } }}
    >
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Mobile drag handle */}
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: borderColor }} />
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `1px solid ${borderColor}` }}>
          <button style={tabStyle(tab === "general")} onClick={() => setTab("general")}>General Bug</button>
          <button style={tabStyle(tab === "analysis")} onClick={() => setTab("analysis")}>Report Incorrect Analysis</button>
        </div>

        {/* General Bug Tab */}
        {tab === "general" && (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: mutedColor }}>
              Your current editor state will be included automatically.
            </p>
            <textarea
              value={generalDesc}
              onChange={(e) => setGeneralDesc(e.target.value)}
              placeholder="Describe what went wrong..."
              rows={4}
              style={{ width: "100%", boxSizing: "border-box", padding: 8, fontSize: 13, fontFamily: "inherit", border: `1px solid ${borderColor}`, borderRadius: 4, resize: "vertical", background: inputBg, color: textColor }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={() => { onClose(); resetState(); }} disabled={generalStatus === "sending"} style={{ padding: "6px 16px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", border: `1px solid ${borderColor}`, borderRadius: 4, background: "none", color: textColor }}>Cancel</button>
              <button onClick={handleSubmitGeneral} disabled={generalStatus === "sending" || !generalDesc.trim()} style={submitBtnStyle(generalStatus, generalStatus === "sending" || !generalDesc.trim())}>
                {generalStatus === "sending" ? "Sending..." : generalStatus === "sent" ? "Sent!" : generalStatus === "error" ? "Failed - Retry" : "Submit"}
              </button>
            </div>
          </>
        )}

        {/* Analysis Correction Tab */}
        {tab === "analysis" && (
          <>
            {!selectedElement ? (
              <>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: mutedColor }}>
                  Select a category, then click the incorrect element in the score.
                </p>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button style={categoryBtnStyle(category === "chord_label")} onClick={() => handleCategorySelect("chord_label")}>
                    Chord Label
                  </button>
                  <button style={categoryBtnStyle(category === "nct_detection")} onClick={() => handleCategorySelect("nct_detection")}>
                    NCT Detection
                  </button>
                  <button style={categoryBtnStyle(category === "part_writing_error")} onClick={() => handleCategorySelect("part_writing_error")}>
                    Part-Writing Error
                  </button>
                </div>
                {category && (
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: dark ? "#5a7" : "#27ae60", fontStyle: "italic" }}>
                    Click on the {category === "chord_label" ? "Roman numeral label" : category === "nct_detection" ? "NCT marker or note" : "error highlight"} in the score...
                  </p>
                )}
              </>
            ) : (
              <>
                {/* Selected element details */}
                <div style={{ background: activeBg, borderRadius: 6, padding: "10px 12px", marginBottom: 12, fontSize: 13 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>What was detected:</div>
                  <div>{selectedElement.currentAnalysis.displayText}</div>
                  <div style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>
                    Beat {selectedElement.location.beat}, m. {selectedElement.location.measure}
                    {selectedElement.location.voice ? ` (${selectedElement.location.voice})` : ""}
                  </div>
                </div>

                {/* Correction input — contextual */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {selectedElement.category === "chord_label" ? "Correct Roman numeral:" :
                     selectedElement.category === "nct_detection" ? "Correct classification:" :
                     "Correct error type:"}
                  </label>

                  {selectedElement.category === "chord_label" && (
                    <input
                      type="text"
                      value={correctionValue}
                      onChange={(e) => setCorrectionValue(e.target.value)}
                      placeholder="e.g. IV, V6/4, vii°7/V"
                      style={{ width: "100%", boxSizing: "border-box", padding: 8, fontSize: 14, fontFamily: "serif", border: `1px solid ${borderColor}`, borderRadius: 4, background: inputBg, color: textColor }}
                    />
                  )}

                  {selectedElement.category === "nct_detection" && (
                    <select
                      value={correctionValue}
                      onChange={(e) => setCorrectionValue(e.target.value)}
                      style={{ width: "100%", padding: 8, fontSize: 13, fontFamily: "inherit", border: `1px solid ${borderColor}`, borderRadius: 4, background: inputBg, color: textColor }}
                    >
                      <option value="">Select...</option>
                      {NCT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  )}

                  {selectedElement.category === "part_writing_error" && (
                    <select
                      value={correctionValue}
                      onChange={(e) => setCorrectionValue(e.target.value)}
                      style={{ width: "100%", padding: 8, fontSize: 13, fontFamily: "inherit", border: `1px solid ${borderColor}`, borderRadius: 4, background: inputBg, color: textColor }}
                    >
                      <option value="">Select...</option>
                      {ERROR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  )}
                </div>

                {/* Optional description */}
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional context (optional)..."
                  rows={2}
                  style={{ width: "100%", boxSizing: "border-box", padding: 8, fontSize: 13, fontFamily: "inherit", border: `1px solid ${borderColor}`, borderRadius: 4, resize: "vertical", background: inputBg, color: textColor, marginBottom: 12 }}
                />

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => { clearSelection(); setCategory(null); setCorrectionValue(""); setDescription(""); }} style={{ padding: "6px 16px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", border: `1px solid ${borderColor}`, borderRadius: 4, background: "none", color: textColor }}>
                    Back
                  </button>
                  <button onClick={handleSubmitCorrection} disabled={!canSubmitCorrection} style={submitBtnStyle(status, !canSubmitCorrection)}>
                    {status === "sending" ? "Sending..." : status === "sent" ? "Sent!" : status === "error" ? "Failed - Retry" : "Submit"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useAuth, API_BASE } from "../auth";
import { useTheme } from "../useTheme";

interface RoadmapItem {
  key: string;
  title: string;
  desc: string;
}

const COMING_SOON: RoadmapItem[] = [
  {
    key: "new-project",
    title: "Projects & Auto Save",
    desc: "Create and manage multiple compositions with automatic cloud saving and version history. Your work saves as you write, so you never lose progress. Name, organize, and switch between projects from your dashboard.",
  },
  {
    key: "solution-gallery",
    title: "Solution Gallery",
    desc: "After completing a community exercise, view how others solved the same problem. Compare voicings, see different harmonic approaches, and learn from the community. Solutions unlock only after you submit your own.",
  },
  {
    key: "share-compositions",
    title: "Share Compositions",
    desc: "Generate a public read-only link to any composition. Share your work with teachers, classmates, or anyone — they can view the score and hear playback without needing an account.",
  },
  {
    key: "export-midi",
    title: "MIDI Export",
    desc: "Export your compositions as standard MIDI files for playback in any DAW or notation software. Multi-voice export preserves your exact voicings, dynamics, and articulations.",
  },
];

const ON_THE_HORIZON: RoadmapItem[] = [
  {
    key: "counterpoint-analysis",
    title: "Counterpoint Analysis",
    desc: "Species counterpoint validation extending the existing analysis engine. Check adherence to first through fifth species rules and get feedback on melodic contour, intervallic motion, and voice independence.",
  },
  {
    key: "mode-transforms",
    title: "Mode Transforms",
    desc: "Transform compositions between parallel and relative modes \u2014 major to minor, Dorian, Mixolydian, and more \u2014 while intelligently adapting chord qualities and melodic intervals.",
  },
  {
    key: "ai-assistant",
    title: "AI Assistant",
    desc: "An integrated AI assistant that can analyze your harmonic choices, suggest continuations, explain theoretical concepts in context, and help you explore compositional possibilities.",
  },
];

const VOTE_THRESHOLD = 1;

export function RoadmapButton({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { token } = useAuth();
  const theme = useTheme();
  const dk = theme.dk;

  const [votes, setVotes] = useState<Record<string, number>>({});
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !token) return;
    fetch(`${API_BASE}/api/roadmap-votes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setVotes(data.counts ?? {});
          setUserVotes(new Set(data.userVotes ?? []));
        }
      })
      .catch(() => {});
  }, [open, token]);

  if (!open || !token) return null;

  const toggleVote = async (featureKey: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/roadmap-votes/${encodeURIComponent(featureKey)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUserVotes(prev => {
          const next = new Set(prev);
          if (data.voted) next.add(featureKey);
          else next.delete(featureKey);
          return next;
        });
        setVotes(prev => ({
          ...prev,
          [featureKey]: (prev[featureKey] ?? 0) + (data.voted ? 1 : -1),
        }));
      }
    } catch { /* ignore */ }
  };

  const renderItem = (item: RoadmapItem) => {
    const count = votes[item.key] ?? 0;
    const voted = userVotes.has(item.key);
    return (
      <div key={item.key} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <button
          onClick={() => toggleVote(item.key)}
          title={voted ? "Remove vote" : "Vote for this feature"}
          style={{
            flexShrink: 0, width: 40, padding: "6px 0", fontSize: 13, fontFamily: "inherit",
            cursor: "pointer",
            border: `1px solid ${theme.cardBorder}`, borderRadius: 6,
            background: voted ? (dk ? "#3a3a50" : "#eef") : "transparent",
            color: theme.text,
            display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.2,
          }}
        >
          <span style={{ fontSize: 15 }}>{voted ? "\u2764\uFE0F" : "\u2661"}</span>
          {count >= VOTE_THRESHOLD && (
            <span style={{ fontSize: 11, marginTop: 1 }}>{count}</span>
          )}
        </button>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600 }}>{item.title}</h4>
          <p style={{ margin: 0, fontSize: 13, color: theme.textSub, lineHeight: 1.5 }}>{item.desc}</p>
        </div>
      </div>
    );
  };

  const tierLabelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
    color: theme.textMuted,
  };

  const dotStyle: React.CSSProperties = {
    width: 10, height: 10, borderRadius: "50%",
    flexShrink: 0,
  };

  const lineStyle: React.CSSProperties = {
    width: 2, flexShrink: 0,
    background: theme.cardBorder,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.2)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: theme.cardBg, borderRadius: 12, padding: 28,
        width: 680, maxWidth: "90vw", maxHeight: "80vh", overflow: "auto",
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        color: theme.text,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Roadmap</h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, fontSize: 18, lineHeight: 1 }}
          >&times;</button>
        </div>

        {/* Timeline layout */}
        <div style={{ display: "flex", gap: 16 }}>
          {/* Timeline track */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 2 }}>
            <div style={{ ...dotStyle, background: dk ? "#7c9cff" : "#4a6fff" }} />
            <div style={{ ...lineStyle, flex: 1, minHeight: 20 }} />
            <div style={{ ...dotStyle, background: theme.cardBorder }} />
            <div style={{ ...lineStyle, flex: 1, minHeight: 20 }} />
            <div style={{ ...dotStyle, background: theme.cardBorder, opacity: 0.5 }} />
          </div>

          {/* Content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Coming Soon */}
            <div>
              <div style={{ ...tierLabelStyle, color: dk ? "#7c9cff" : "#4a6fff", marginBottom: 12 }}>
                Coming Soon
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {COMING_SOON.map(renderItem)}
              </div>
            </div>

            {/* On the Horizon */}
            <div>
              <div style={{ ...tierLabelStyle, marginBottom: 12 }}>
                On the Horizon
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {ON_THE_HORIZON.map(renderItem)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

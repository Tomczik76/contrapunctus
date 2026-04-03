import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TREBLE_CLEF_PATH, BASS_CLEF_PATH, NOTEHEAD_BLACK, NOTEHEAD_HALF, GLYPH_SCALE } from "./staff/glyphs";
import { STEP, SPACE, STEM_HEIGHT, STEM_W, LINE_W } from "./staff/constants";

const NOTEHEAD_BLACK_PATH = NOTEHEAD_BLACK.path;
const NOTEHEAD_HALF_PATH = NOTEHEAD_HALF.path;

function dpToY(dp: number, staffTopDp: number, yOff: number): number {
  return yOff + (staffTopDp - dp) * STEP;
}

function ChordGlyph({ x, dps, staffTopDp, yOff, half, color }: {
  x: number; dps: number[]; staffTopDp: number; yOff: number; half?: boolean; color: string;
}) {
  const path = half ? NOTEHEAD_HALF_PATH : NOTEHEAD_BLACK_PATH;
  const headW = 425 * GLYPH_SCALE;
  const sorted = [...dps].sort((a, b) => a - b);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];
  const middleDp = staffTopDp - 4;
  const avg = (lowest + highest) / 2;
  const stemUp = avg <= middleDp;
  const stemX = stemUp ? x + headW - STEM_W / 2 : x + STEM_W / 2;
  const anchorDp = stemUp ? lowest : highest;
  const anchorY = dpToY(anchorDp, staffTopDp, yOff);
  const tipY = stemUp ? dpToY(highest, staffTopDp, yOff) - STEM_HEIGHT : dpToY(lowest, staffTopDp, yOff) + STEM_HEIGHT;
  return (
    <g>
      {sorted.map((dp) => {
        const y = dpToY(dp, staffTopDp, yOff);
        return (
          <g key={dp} transform={`translate(${x},${y}) scale(${GLYPH_SCALE},${-GLYPH_SCALE})`}>
            <path d={path} fill={color} />
          </g>
        );
      })}
      <line x1={stemX} y1={anchorY} x2={stemX} y2={tipY} stroke={color} strokeWidth={STEM_W} />
    </g>
  );
}

// ── CSS for animations ──────────────────────────────────────────────

const LANDING_CSS = `
@keyframes chordFadeIn {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes rnFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.landing-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.landing-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.12) !important;
}
.landing-cta {
  transition: transform 0.1s ease;
}
.landing-cta:active {
  transform: scale(0.97);
}
.landing-footer-link {
  color: inherit;
  opacity: 0.6;
  text-decoration: none;
  transition: opacity 0.15s ease;
}
.landing-footer-link:hover {
  opacity: 1;
}
@media (max-width: 700px) {
  .features-grid {
    grid-template-columns: 1fr !important;
  }
  .personas-grid {
    grid-template-columns: 1fr !important;
  }
  .landing-nav {
    padding: 12px 16px !important;
    flex-wrap: wrap !important;
    gap: 8px !important;
  }
  .landing-nav-btns {
    gap: 6px !important;
  }
  .landing-nav-btns a {
    padding: 5px 10px !important;
    font-size: 12px !important;
  }
  .landing-nav-btns button {
    padding: 5px 8px !important;
    font-size: 14px !important;
  }
  .landing-nav-btns button span {
    display: none !important;
  }
  .landing-hero {
    padding: 40px 16px 24px !important;
  }
  .landing-hero-btns a {
    padding: 12px 24px !important;
    font-size: 15px !important;
  }
}
`;

// ── Staff illustration ──────────────────────────────────────────────

function StaffIllustration({ color = "#1a1a1a" }: { color?: string }) {
  const staffW = 700;
  const trebleTopDp = 38;
  const bassTopDp = 26;
  const topPad = 40;
  const trebleY = topPad;
  const staffHeight = 4 * SPACE;
  const staffGap = 70;
  const bassY = trebleY + staffHeight + staffGap;
  const botPad = 60;
  const svgH = bassY + staffHeight + botPad;

  // I, IV, V, vi, ii, V, I in C major
  const chords: { x: number; half?: boolean; treble: number[]; bass: number[] }[] = [
    { x: 100, treble: [28, 32, 35], bass: [21] },
    { x: 180, treble: [28, 31, 33], bass: [24] },
    { x: 260, treble: [29, 32, 34], bass: [25] },
    { x: 340, half: true, treble: [28, 30, 33], bass: [19] },
    { x: 420, treble: [29, 31, 33], bass: [22] },
    { x: 500, half: true, treble: [29, 32, 34], bass: [25] },
    { x: 580, treble: [28, 32, 35], bass: [21] },
  ];
  const rnLabels = ["I", "IV", "V", "vi", "ii", "V", "I"];
  const chordDelay = 500; // ms between each chord

  return (
    <svg
      width="100%"
      height={svgH}
      viewBox={`0 0 ${staffW} ${svgH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ maxWidth: 660, display: "block", margin: "0 auto", opacity: 0.22 }}
    >
      {/* Treble staff lines */}
      {Array.from({ length: 5 }, (_, i) => {
        const y = trebleY + i * SPACE;
        return <line key={`t${i}`} x1={0} y1={y} x2={staffW} y2={y} stroke={color} strokeWidth={LINE_W} />;
      })}
      {/* Bass staff lines */}
      {Array.from({ length: 5 }, (_, i) => {
        const y = bassY + i * SPACE;
        return <line key={`b${i}`} x1={0} y1={y} x2={staffW} y2={y} stroke={color} strokeWidth={LINE_W} />;
      })}

      {/* Treble clef */}
      <path d={TREBLE_CLEF_PATH} fill={color} stroke="none"
        transform={`translate(${8},${dpToY(32, trebleTopDp, trebleY)}) scale(${GLYPH_SCALE},${-GLYPH_SCALE})`} />
      {/* Bass clef */}
      <path d={BASS_CLEF_PATH} fill={color} stroke="none"
        transform={`translate(${8},${dpToY(24, bassTopDp, bassY)}) scale(${GLYPH_SCALE},${-GLYPH_SCALE})`} />

      {/* Animated chords */}
      {chords.map((chord, i) => (
        <g key={chord.x} style={{
          opacity: 0,
          animation: `chordFadeIn 0.4s ease forwards`,
          animationDelay: `${i * chordDelay}ms`,
        }}>
          <ChordGlyph x={chord.x} dps={chord.treble} staffTopDp={trebleTopDp} yOff={trebleY} half={chord.half} color={color} />
          <ChordGlyph x={chord.x} dps={chord.bass} staffTopDp={bassTopDp} yOff={bassY} half={chord.half} color={color} />
        </g>
      ))}

      {/* Animated roman numerals */}
      {chords.map((chord, i) => (
        <text
          key={`rn${i}`}
          x={chord.x + 5}
          y={bassY + staffHeight + 36}
          fontSize={13}
          fontFamily="'Libre Baskerville', serif"
          fontStyle="italic"
          fill={color}
          textAnchor="middle"
          style={{
            opacity: 0,
            animation: `rnFadeIn 0.3s ease forwards`,
            animationDelay: `${i * chordDelay + 250}ms`,
          }}
        >
          {rnLabels[i]}
        </text>
      ))}
    </svg>
  );
}

// ── Data ────────────────────────────────────────────────────────────


const features = [
  {
    title: "Real-Time Harmonic Analysis",
    desc: "Roman numerals and chord types appear instantly as you write. Triads, sevenths, extensions, secondary dominants, and more, all labeled in context.",
  },
  {
    title: "Part-Writing Error Detection",
    desc: "Catch parallel fifths, voice crossing, spacing errors, unresolved tendency tones, and other part-writing violations as you write.",
  },
  {
    title: "Non-Chord Tone Detection",
    desc: "Passing tones, neighbor tones, suspensions, and other embellishments are automatically classified and annotated on the score.",
  },
  {
    title: "Multi-Voice Composition",
    desc: "Write for any number of voices across treble and bass clefs with full control over rhythm, accidentals, and voicing.",
  },
  {
    title: "Key & Scale Awareness",
    desc: "Set your key signature and mode. Analysis adapts to major, minor, and modal contexts with correct diatonic chord labeling.",
  },
  {
    title: "Music Playback",
    desc: "Listen to your composition with sampled piano and other instruments. Set tempo, choose where to start, and hear your music come to life.",
  },
];

const personas: { title: string; desc: string; qualifier?: string; link?: { text: string; to: string } }[] = [
  {
    title: "Students",
    desc: "Join your instructor's class with a single link and start working through exercises. Save drafts, submit when ready, and practice beyond coursework with community challenges.",
  },
  {
    title: "Educators",
    desc: "Author custom exercises and assign them to your class. Review submissions, assign grades, and track completion from one gradebook.",
    link: { text: "Sign up as an educator \u2192", to: "/signup" },
  },
  {
    title: "Theory Enthusiasts",
    desc: "Solve community exercises, create your own, and climb the ranks from Motif to Opus. There's always a new challenge waiting.",
    link: { text: "Browse exercises \u2192", to: "/community" },
  },
  {
    title: "Composers",
    desc: "Save projects to the cloud, pick up where you left off on any device, and sketch ideas with real-time harmonic analysis as you write.",
  },
];

const roadmapSoon = [
  { title: "Solution Gallery", desc: "After completing an exercise, see how others solved the same problem." },
  { title: "Share Compositions", desc: "Generate a public read-only link to share your work with anyone." },
  { title: "MIDI Export", desc: "Export to any DAW or notation software with full voice preservation." },
];
const roadmapHorizon = [
  { title: "Counterpoint Analysis", desc: "Species counterpoint validation extending the analysis engine." },
  { title: "Mode Transforms", desc: "Transform between parallel and relative modes with intelligent adaptation." },
  { title: "AI Assistant", desc: "Harmonic analysis, suggestions, and compositional exploration." },
];

// ── Component ───────────────────────────────────────────────────────

export function LandingPage() {
  const [dk, setDk] = useState(() => {
    try { return localStorage.getItem("contrapunctus_dark") === "true"; } catch { return false; }
  });

  // Listen for storage changes (if toggled in another tab or the editor)
  useEffect(() => {
    const handler = () => setDk(localStorage.getItem("contrapunctus_dark") === "true");
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    document.body.style.background = dk ? "#1a1a1e" : "#e8e4e0";
    document.body.style.color = dk ? "#e0ddd8" : "#2c2c2c";
  }, [dk]);

  const t = {
    text: dk ? "#e0ddd8" : "#1a1a1a",
    textSub: dk ? "#aaa" : "#555",
    textMuted: dk ? "#888" : "#888",
    textFaint: dk ? "#666" : "#999",
    cardBg: dk ? "#2a2a30" : "#fff",
    cardShadow: dk ? "0 1px 3px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15)" : "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)",
    btnBg: dk ? "#e0ddd8" : "#1a1a1a",
    btnText: dk ? "#1a1a1e" : "#fff",
    borderColor: dk ? "#3a3a40" : "#999",
    footerBorder: dk ? "#3a3a40" : "#d5d0cb",
    badgeBg: dk ? "#32323a" : "#f0eeeb",
    illustrationColor: dk ? "#e0ddd8" : "#1a1a1a",
  };

  const cardStyle: React.CSSProperties = {
    background: t.cardBg,
    borderRadius: 8,
    padding: "24px 22px",
    boxShadow: t.cardShadow,
  };

  const sectionHeadingStyle: React.CSSProperties = {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: -0.5,
    textAlign: "center" as const,
    marginBottom: 40,
    color: t.text,
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: dk ? "#1a1a1e" : "#e8e4e0", color: dk ? "#e0ddd8" : "#2c2c2c" }}>
      <style>{LANDING_CSS}</style>

      {/* Nav */}
      <nav className="landing-nav" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 32px",
        maxWidth: 1080,
        width: "100%",
        margin: "0 auto",
      }}>
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: t.text }}>
          Contrapunctus
        </span>
        <div className="landing-nav-btns" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* Nav links container — add future items (Docs, Pricing, Blog) here */}
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginRight: 4 }}>
            <button
              onClick={() => { const v = !dk; setDk(v); localStorage.setItem("contrapunctus_dark", String(v)); }}
            style={{
              background: dk ? "#3a3a40" : "#f0eeeb",
              border: `1px solid ${t.borderColor}`,
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 16,
              padding: "6px 12px",
              color: t.text,
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
            title={dk ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dk ? "☀" : "☾"} <span style={{ fontSize: 13 }}>{dk ? "Light" : "Dark"}</span>
          </button>
          </div>
          <Link to="/login" className="landing-cta" style={{
            padding: "8px 18px",
            fontSize: 14,
            fontFamily: "inherit",
            color: t.text,
            textDecoration: "none",
            border: `1px solid ${t.borderColor}`,
            borderRadius: 4,
          }}>
            Sign In
          </Link>
          <Link to="/signup" className="landing-cta" style={{
            padding: "8px 18px",
            fontSize: 14,
            fontFamily: "inherit",
            color: t.btnText,
            background: t.btnBg,
            textDecoration: "none",
            borderRadius: 4,
          }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero" style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "64px 24px 32px",
        maxWidth: 760,
        margin: "0 auto",
        width: "100%",
      }}>
        <h1 style={{
          fontSize: "clamp(32px, 6vw, 48px)",
          fontWeight: 700,
          letterSpacing: -1,
          lineHeight: 1.15,
          color: t.text,
          marginBottom: 12,
        }}>
          Compose with clarity.
        </h1>
        <p style={{
          fontSize: 15,
          color: t.textMuted,
          marginBottom: 20,
          letterSpacing: 0.3,
        }}>
          Built for theory students, educators, and the music theory community.
        </p>
        <p style={{
          fontSize: "clamp(16px, 3vw, 19px)",
          lineHeight: 1.65,
          color: t.textSub,
          maxWidth: 620,
          marginBottom: 32,
        }}>
          A music theory platform with real-time harmonic analysis, part-writing feedback,
          and non-chord tone detection. Join a community of theory enthusiasts solving exercises,
          or use the classroom tools to author assignments and track student progress.
        </p>
        <div className="landing-hero-btns" style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <Link to="/signup" className="landing-cta" style={{
            padding: "14px 32px",
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "inherit",
            color: t.btnText,
            background: t.btnBg,
            textDecoration: "none",
            borderRadius: 6,
          }}>
            Create Free Account
          </Link>
          <Link to="/login" className="landing-cta" style={{
            padding: "14px 32px",
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "inherit",
            color: t.text,
            background: "none",
            textDecoration: "none",
            border: `1px solid ${t.borderColor}`,
            borderRadius: 6,
          }}>
            Sign In
          </Link>
        </div>
        <p style={{
          fontSize: 13,
          color: t.textFaint,
          marginTop: 14,
        }}>
          Free for beta users. No credit card required.
        </p>
      </section>

      {/* Staff illustration with chord animation */}
      <div style={{ padding: "0 24px 48px", overflow: "hidden" }}>
        <StaffIllustration color={t.illustrationColor} />
      </div>

      {/* Community */}
      <section style={{
        padding: "48px 24px 72px",
        maxWidth: 960,
        margin: "0 auto",
        width: "100%",
      }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ ...sectionHeadingStyle, marginBottom: 12 }}>
            Practice with the community
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: t.textSub, maxWidth: 560, margin: "0 auto" }}>
            Create exercises, solve others' challenges, earn points, and climb the ranks.
          </p>
        </div>

        <div className="features-grid" style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 28,
        }}>
          <div className="landing-card" style={{ ...cardStyle, height: "100%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: t.text }}>Create &amp; Solve</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: t.textSub, margin: 0 }}>
              Build your own theory exercises or attempt challenges created by the community.
              Harmonize melodies, analyze chord progressions, and sharpen your skills with fresh content every day.
            </p>
          </div>
          <div className="landing-card" style={{ ...cardStyle, height: "100%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: t.text }}>Earn Your Rank</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: t.textSub, margin: 0 }}>
              Earn points for completing exercises, creating content, and contributing corrections.
              Progress through 15 music-themed ranks.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
              {["Motif", "Phrase", "Period", "Theme", "Variation", "Invention", "Fugue", "Suite", "Sonata", "Concerto", "Symphony", "Requiem", "Oratorio", "Mass", "Opus"].map((rank, i) => (
                <span key={rank} style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: i < 3 ? (dk ? "rgba(110,231,160,0.15)" : "rgba(22,163,74,0.08)") : (dk ? "#32323a" : "#f0eeeb"),
                  color: i < 3 ? (dk ? "#6ee7a0" : "#16a34a") : t.textMuted,
                  fontWeight: i === 14 ? 700 : 400,
                }}>
                  {rank}
                </span>
              ))}
            </div>
          </div>
          <div className="landing-card" style={{ ...cardStyle, height: "100%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: t.text }}>Compete &amp; Climb</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: t.textSub, margin: 0 }}>
              See how you stack up on the weekly and all-time leaderboards.
              Upvote the best exercises and help surface quality content for the whole community.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 36, flexWrap: "wrap" }}>
          <Link to="/community" className="landing-cta" style={{
            padding: "14px 32px",
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "inherit",
            color: t.btnText,
            background: t.btnBg,
            textDecoration: "none",
            borderRadius: 6,
          }}>
            Browse Exercises
          </Link>
          <Link to="/signup" className="landing-cta" style={{
            padding: "14px 32px",
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "inherit",
            color: t.text,
            background: "none",
            textDecoration: "none",
            border: `1px solid ${t.borderColor}`,
            borderRadius: 6,
          }}>
            Create Free Account
          </Link>
        </div>
      </section>

      {/* Classroom */}
      <section style={{
        padding: "48px 24px 72px",
        maxWidth: 960,
        margin: "0 auto",
        width: "100%",
      }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ ...sectionHeadingStyle, marginBottom: 12 }}>
            Designed for the theory classroom
          </h2>
          <span style={{
            display: "inline-block",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.5,
            color: dk ? "#6ee7a0" : "#16a34a",
            background: dk ? "rgba(22,163,74,0.15)" : "rgba(22,163,74,0.08)",
            padding: "4px 12px",
            borderRadius: 12,
            textTransform: "uppercase",
          }}>
            New
          </span>
        </div>

        <div className="features-grid" style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 28,
        }}>
          <div className="landing-card" style={{ ...cardStyle, height: "100%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: t.text }}>Create Classes</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: t.textSub, margin: 0 }}>
              Set up a class and share an invite link. Students join with one click, no codes to type, no roster to manage.
            </p>
          </div>
          <div className="landing-card" style={{ ...cardStyle, height: "100%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: t.text }}>Author Exercises</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: t.textSub, margin: 0 }}>
              Build melody harmonization, figured bass realization, and Roman numeral analysis assignments with the same editor your students use. Preview before assigning.
            </p>
          </div>
          <div className="landing-card" style={{ ...cardStyle, height: "100%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: t.text }}>Grade &amp; Track Progress</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: t.textSub, margin: 0 }}>
              See which students have submitted each assignment, review their work, and assign grades. A color-coded gradebook shows scores and averages at a glance.
            </p>
          </div>
        </div>

        <div className="landing-card" style={{ ...cardStyle, marginTop: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: t.text }}>Exercise types</h3>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8, color: t.textSub }}>
            <li>Harmonize a soprano melody in 4-part chorale style</li>
            <li>Realize a figured bass line with proper voice leading</li>
            <li>Analyze a given chorale and enter the correct Roman numerals</li>
            <li>Progressive difficulty from basic triads through secondary dominants and modulation</li>
          </ul>
          <div style={{ marginTop: 16 }}>
            <Link to="/community" style={{
              fontSize: 14,
              fontWeight: 600,
              color: dk ? "#6ee7a0" : "#16a34a",
              textDecoration: "none",
            }}>
              Try an exercise &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Analysis features */}
      <section style={{
        padding: "0 24px 72px",
        maxWidth: 960,
        margin: "0 auto",
        width: "100%",
      }}>
        <h2 style={sectionHeadingStyle}>
          Powered by real-time analysis
        </h2>
        <div className="features-grid" style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 28,
        }}>
          {features.map((f) => (
            <div key={f.title} className="landing-card" style={{ ...cardStyle, height: "100%" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: t.text }}>{f.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: t.textSub, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section style={{
        padding: "0 24px 72px",
        maxWidth: 960,
        margin: "0 auto",
        width: "100%",
      }}>
        <h2 style={sectionHeadingStyle}>
          Who it's for
        </h2>
        <div className="personas-grid" style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 28,
        }}>
          {personas.map((p) => (
            <div key={p.title} className="landing-card" style={{ ...cardStyle, height: "100%" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: t.text }}>{p.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: t.textSub, margin: 0 }}>{p.desc}</p>
              {p.qualifier && (
                <p style={{ fontSize: 12, color: t.textFaint, marginTop: 8, marginBottom: 0, fontStyle: "italic" }}>
                  {p.qualifier}
                </p>
              )}
              {p.link && (
                <div style={{ marginTop: 12 }}>
                  <Link to={p.link.to} style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: dk ? "#6ee7a0" : "#16a34a",
                    textDecoration: "none",
                  }}>
                    {p.link.text}
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section style={{
        padding: "0 24px 80px",
        maxWidth: 960,
        margin: "0 auto",
        width: "100%",
      }}>
        <h2 style={{ ...sectionHeadingStyle, marginBottom: 36 }}>
          What's next
        </h2>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: dk ? "#7c9cff" : "#4a6fff", flexShrink: 0 }} />
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1,
                color: dk ? "#7c9cff" : "#4a6fff",
              }}>
                Coming Soon
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginLeft: 5, paddingLeft: 19, borderLeft: `2px solid ${dk ? "#3a3a40" : "#d5d0cb"}` }}>
              {roadmapSoon.map(item => (
                <div key={item.title}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 2px" }}>{item.title}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.5, color: t.textSub, margin: 0 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: dk ? "#3a3a40" : "#d5d0cb", flexShrink: 0, marginLeft: 1 }} />
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1,
                color: t.textMuted,
              }}>
                On the Horizon
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginLeft: 5, paddingLeft: 19, borderLeft: `2px solid ${dk ? "#3a3a40" : "#d5d0cb"}`, opacity: 0.85 }}>
              {roadmapHorizon.map(item => (
                <div key={item.title}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: "0 0 2px" }}>{item.title}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.5, color: t.textSub, margin: 0 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section style={{
        padding: "48px 24px 56px",
        textAlign: "center",
        maxWidth: 600,
        margin: "0 auto",
        width: "100%",
      }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: t.text, marginBottom: 10 }}>
          Ready to start?
        </h2>
        <p style={{ fontSize: 15, color: t.textSub, marginBottom: 24, lineHeight: 1.6 }}>
          Free during beta. No credit card required.
        </p>
        <Link to="/signup" className="landing-cta" style={{
          display: "inline-block",
          padding: "14px 36px",
          fontSize: 16,
          fontWeight: 700,
          fontFamily: "inherit",
          color: t.btnText,
          background: t.btnBg,
          textDecoration: "none",
          borderRadius: 6,
        }}>
          Create Free Account
        </Link>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: `1px solid ${t.footerBorder}`,
        padding: "32px 24px",
        marginTop: "auto",
      }}>
        <div style={{
          maxWidth: 960,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "24px 48px",
        }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 700, color: t.text, display: "block", marginBottom: 4 }}>
              Contrapunctus
            </span>
            <span style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 6 }}>
              Built by a music theory nerd and software engineer in Minneapolis.
            </span>
            <a href="mailto:info@contrapunctus.app" style={{ fontSize: 13, color: t.textMuted, textDecoration: "none", opacity: 0.8 }}>
              info@contrapunctus.app
            </a>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
            <a href="https://discord.gg/zSTuZ65m" target="_blank" rel="noopener noreferrer" className="landing-footer-link" style={{ fontSize: 13 }}>Discord</a>
            <Link to="/login" className="landing-footer-link" style={{ fontSize: 13 }}>Sign In</Link>
            <Link to="/signup" className="landing-footer-link" style={{ fontSize: 13 }}>Get Started</Link>
          </div>
        </div>
        <div style={{
          maxWidth: 960,
          margin: "0 auto",
          borderTop: `1px solid ${t.footerBorder}`,
          marginTop: 24,
          paddingTop: 16,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px 24px",
        }}>
          <span style={{ fontSize: 12, color: t.textFaint }}>&copy; 2026 Contrapunctus</span>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <a href="#" className="landing-footer-link" style={{ fontSize: 12 }}>Privacy</a>
            <a href="#" className="landing-footer-link" style={{ fontSize: 12 }}>Terms</a>
            <a href="mailto:info@contrapunctus.app" className="landing-footer-link" style={{ fontSize: 12 }}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

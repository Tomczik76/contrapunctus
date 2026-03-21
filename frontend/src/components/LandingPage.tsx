import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

// ── Reuse glyph rendering from Staff.tsx ────────────────────────────

function vexOutlineToSvgPath(outline: string): string {
  const tokens = outline.split(/\s+/);
  const parts: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case "m": parts.push(`M ${tokens[i++]} ${tokens[i++]}`); break;
      case "l": parts.push(`L ${tokens[i++]} ${tokens[i++]}`); break;
      case "q": { const ex = tokens[i++], ey = tokens[i++], cx = tokens[i++], cy = tokens[i++]; parts.push(`Q ${cx} ${cy} ${ex} ${ey}`); break; }
      case "b": { const ex = tokens[i++], ey = tokens[i++], c1x = tokens[i++], c1y = tokens[i++], c2x = tokens[i++], c2y = tokens[i++]; parts.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`); break; }
      case "z": parts.push("Z"); break;
    }
  }
  return parts.join(" ");
}

const TREBLE_CLEF_PATH = vexOutlineToSvgPath(
  "m 541 598 b 550 625 539 615 541 616 b 824 1174 706 770 824 953" +
  " b 730 1509 824 1299 789 1423 b 655 1581 708 1541 671 1581" +
  " b 562 1512 635 1581 590 1544 b 420 1064 455 1394 420 1214" +
  " b 441 828 420 981 431 887 b 428 793 444 811 445 808" +
  " b 0 125 220 622 0 416 b 524 -363 0 -125 171 -363" +
  " b 624 -354 557 -363 595 -360 b 645 -367 639 -351 642 -350" +
  " b 684 -657 662 -464 684 -589 b 455 -896 684 -870 540 -896" +
  " b 340 -854 377 -896 340 -873 b 386 -829 340 -844 353 -840" +
  " b 482 -694 431 -816 482 -778 b 344 -547 482 -615 432 -547" +
  " b 190 -713 248 -547 190 -624 b 464 -948 190 -806 246 -948" +
  " b 747 -660 560 -948 747 -904 b 706 -351 747 -577 721 -441" +
  " b 724 -327 703 -334 704 -336 b 966 16 870 -269 966 -147" +
  " b 619 363 966 200 831 363 b 577 389 582 363 582 363 z" +
  " m 677 1358 b 763 1240 724 1358 763 1319" +
  " b 513 851 763 1080 626 950 b 494 863 503 842 497 844" +
  " b 485 995 488 900 485 949 b 677 1358 485 1220 589 1358 z" +
  " m 520 377 b 498 343 524 350 524 351" +
  " b 289 63 372 300 289 186 b 455 -192 289 -66 357 -158" +
  " b 494 -200 467 -196 484 -200 b 511 -184 505 -200 511 -193" +
  " b 490 -166 511 -174 500 -170 b 386 -12 429 -140 386 -78" +
  " b 530 157 386 71 442 132 b 559 145 553 163 556 161" +
  " l 631 -284 b 611 -304 634 -300 632 -300" +
  " b 530 -311 588 -308 559 -311 b 115 29 278 -311 115 -171" +
  " b 249 363 115 114 130 228 b 469 567 336 459 402 513" +
  " b 490 562 484 579 487 577 z" +
  " m 619 148 b 635 168 616 166 618 170" +
  " b 848 -66 752 158 848 60 b 713 -271 848 -157 793 -230" +
  " b 690 -262 696 -279 693 -279 z"
);

const BASS_CLEF_PATH = vexOutlineToSvgPath(
  "m 363 377 b 0 56 112 377 0 194 b 177 -158 0 -59 60 -158" +
  " b 330 -6 268 -158 330 -95 b 192 144 330 86 262 144" +
  " b 120 134 153 144 138 134 b 96 160 101 134 96 145" +
  " b 330 323 96 217 183 323 b 549 -53 482 323 549 173" +
  " b 14 -871 549 -455 350 -680 b -7 -897 1 -878 -7 -886" +
  " b 12 -914 -7 -906 -1 -914 b 36 -907 19 -914 27 -912" +
  " b 765 -40 390 -734 765 -478 b 363 377 765 210 612 377 z" +
  " m 906 259 b 827 180 861 259 827 225" +
  " b 906 101 827 135 861 101 b 985 180 950 101 985 135" +
  " b 906 259 985 225 950 259 z" +
  " m 907 -102 b 829 -180 863 -102 829 -135" +
  " b 907 -258 829 -225 863 -258 b 985 -180 952 -258 985 -225" +
  " b 907 -102 985 -135 952 -102 z"
);

const NOTEHEAD_BLACK_PATH = vexOutlineToSvgPath(
  "m 140 -180 b 425 60 268 -180 425 -62 b 285 180 425 134 367 180 b 0 -60 127 180 0 63 b 140 -180 0 -135 62 -180 z"
);

const NOTEHEAD_HALF_PATH = vexOutlineToSvgPath(
  "m 140 -180 b 425 60 377 -180 425 13 b 282 180 425 134 366 180 b 0 -60 68 180 0 14 b 140 -180 0 -137 60 -180 z m 108 -125 b 50 -92 78 -125 60 -109 b 42 -63 46 -84 42 -73 b 318 121 42 7 251 121 b 372 91 346 121 361 108 b 380 63 376 82 380 73 b 108 -125 380 1 177 -125 z"
);

/** Layout constants matching Staff.tsx */
const STEP = 6;
const SPACE = STEP * 2;
const GLYPH_SCALE = 0.0253 * (SPACE / 10);
const STEM_HEIGHT = 35 * (SPACE / 10);
const STEM_W = 1.5;
const LINE_W = 1;

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
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.landing-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.landing-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08) !important;
}
.landing-cta {
  transition: transform 0.1s ease;
}
.landing-cta:active {
  transform: scale(0.97);
}
.landing-footer-link {
  color: #666;
  text-decoration: none;
  transition: color 0.15s ease;
}
.landing-footer-link:hover {
  color: #1a1a1a;
}
`;

// ── Staff illustration ──────────────────────────────────────────────

function StaffIllustration() {
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
  const color = "#1a1a1a";

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

// ── Intersection Observer hook for scroll animations ────────────────

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function RevealSection({ children, delay = 0, style }: {
  children: React.ReactNode; delay?: number; style?: React.CSSProperties;
}) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} style={{
      opacity: 0,
      transform: "translateY(20px)",
      transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Data ────────────────────────────────────────────────────────────

const features = [
  {
    title: "Real-Time Harmonic Analysis",
    desc: "See roman numeral analysis update instantly as you write. Every chord is identified in context: triads, sevenths, extensions, secondary dominants, and more.",
  },
  {
    title: "Non-Chord Tone Detection",
    desc: "Passing tones, neighbor tones, suspensions, and other embellishments are automatically classified and annotated on the score.",
  },
  {
    title: "Multi-Voice Composition",
    desc: "Write for up to four voices across treble and bass clefs with full control over rhythm, accidentals, and voicing.",
  },
  {
    title: "Key & Scale Awareness",
    desc: "Set your key signature and mode. Analysis adapts to major, minor, and modal contexts with correct diatonic chord labeling.",
  },
];

const personas = [
  {
    title: "Students",
    desc: "Get instant feedback on harmony exercises, part writing, and counterpoint assignments.",
  },
  {
    title: "Educators",
    desc: "Assign theory exercises and let Contrapunctus check the rules so you can focus on teaching.",
  },
  {
    title: "Composers",
    desc: "Sketch ideas with real-time harmonic awareness. Export MIDI when you're ready.",
  },
];

const comingSoon = [
  "Part-writing error detection",
  "Counterpoint analysis",
  "MIDI export",
  "AI composition assistant",
];

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  padding: "24px 22px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: -0.5,
  textAlign: "center" as const,
  marginBottom: 40,
  color: "#1a1a1a",
};

// ── Component ───────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{LANDING_CSS}</style>

      {/* Nav */}
      <nav style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 32px",
        maxWidth: 1080,
        width: "100%",
        margin: "0 auto",
      }}>
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: "#1a1a1a" }}>
          Contrapunctus
        </span>
        <div style={{ display: "flex", gap: 12 }}>
          <Link to="/login" className="landing-cta" style={{
            padding: "8px 18px",
            fontSize: 14,
            fontFamily: "inherit",
            color: "#1a1a1a",
            textDecoration: "none",
            border: "1px solid #999",
            borderRadius: 4,
          }}>
            Sign In
          </Link>
          <Link to="/signup" className="landing-cta" style={{
            padding: "8px 18px",
            fontSize: 14,
            fontFamily: "inherit",
            color: "#fff",
            background: "#1a1a1a",
            textDecoration: "none",
            borderRadius: 4,
          }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
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
          color: "#1a1a1a",
          marginBottom: 12,
        }}>
          Compose with clarity.
        </h1>
        <p style={{
          fontSize: 15,
          color: "#888",
          marginBottom: 20,
          letterSpacing: 0.3,
        }}>
          Built for theory students, composers, and educators.
        </p>
        <p style={{
          fontSize: "clamp(16px, 3vw, 19px)",
          lineHeight: 1.65,
          color: "#555",
          maxWidth: 560,
          marginBottom: 32,
        }}>
          Contrapunctus is a music theory workbench that analyzes harmony in real time.
          Write notes on a staff, and see roman numerals, chord extensions, and
          non-chord tones appear as you compose.
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <Link to="/signup" className="landing-cta" style={{
            padding: "14px 32px",
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "inherit",
            color: "#fff",
            background: "#1a1a1a",
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
            color: "#1a1a1a",
            background: "none",
            textDecoration: "none",
            border: "1px solid #999",
            borderRadius: 6,
          }}>
            Sign In
          </Link>
        </div>
        <p style={{
          fontSize: 13,
          color: "#999",
          marginTop: 14,
        }}>
          Free for beta users. No credit card required.
        </p>
      </section>

      {/* Staff illustration with chord animation */}
      <div style={{ padding: "0 24px 48px", overflow: "hidden" }}>
        <StaffIllustration />
      </div>

      {/* Features */}
      <section style={{
        padding: "48px 24px 72px",
        maxWidth: 960,
        margin: "0 auto",
        width: "100%",
      }}>
        <RevealSection>
          <h2 style={sectionHeadingStyle}>
            Built for music theory
          </h2>
        </RevealSection>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 28,
        }}>
          {features.map((f, i) => (
            <RevealSection key={f.title} delay={i * 120}>
              <div className="landing-card" style={cardStyle}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#1a1a1a" }}>{f.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "#555", margin: 0 }}>{f.desc}</p>
              </div>
            </RevealSection>
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
        <RevealSection>
          <h2 style={sectionHeadingStyle}>
            Who it's for
          </h2>
        </RevealSection>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 28,
        }}>
          {personas.map((p, i) => (
            <RevealSection key={p.title} delay={i * 120}>
              <div className="landing-card" style={cardStyle}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#1a1a1a" }}>{p.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "#555", margin: 0 }}>{p.desc}</p>
              </div>
            </RevealSection>
          ))}
        </div>
      </section>

      {/* Coming soon */}
      <section style={{
        padding: "0 24px 80px",
        maxWidth: 960,
        margin: "0 auto",
        width: "100%",
      }}>
        <RevealSection>
          <h2 style={{ ...sectionHeadingStyle, marginBottom: 28 }}>
            Coming soon
          </h2>
        </RevealSection>
        <RevealSection delay={100}>
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "12px 32px",
          }}>
            {comingSoon.map((item, i) => (
              <span key={item} style={{
                fontSize: 15,
                color: "#666",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                {i > 0 && <span style={{ color: "#ccc", fontSize: 18, lineHeight: 1, userSelect: "none" }} aria-hidden>·</span>}
                {item}
              </span>
            ))}
          </div>
        </RevealSection>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid #d5d0cb",
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
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", display: "block", marginBottom: 6 }}>
              Contrapunctus
            </span>
            <span style={{ fontSize: 13, color: "#888" }}>
              Real-time harmonic analysis for the modern musician.
            </span>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link to="/login" className="landing-footer-link" style={{ fontSize: 13 }}>Sign In</Link>
            <Link to="/signup" className="landing-footer-link" style={{ fontSize: 13 }}>Get Started</Link>
          </div>
        </div>
        <div style={{
          maxWidth: 960,
          margin: "16px auto 0",
          fontSize: 12,
          color: "#aaa",
        }}>
          Made for musicians.
        </div>
      </footer>
    </div>
  );
}

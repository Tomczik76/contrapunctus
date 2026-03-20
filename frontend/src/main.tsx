import { createRoot } from "react-dom/client";
import { Contrapunctus } from "contrapunctus";
import type { ContrapunctusApi } from "./contrapunctus";
import { GrandStaff, NoteEditor } from "./components/Staff";

const C = Contrapunctus as ContrapunctusApi;

function chord(...notes: [string, string, number][]) {
  return C.beat(notes.map(([l, a, o]) => C.note(l, a, o)));
}

// C Major Scale
const cMajorScale = [
  C.measure(4, 4, [
    chord(["C", "", 4]),
    chord(["D", "", 4]),
    chord(["E", "", 4]),
    chord(["F", "", 4]),
  ]),
  C.measure(4, 4, [
    chord(["G", "", 4]),
    chord(["A", "", 4]),
    chord(["B", "", 4]),
    chord(["C", "", 5]),
  ]),
];

// I–IV–V–I chord progression
const chordProgression = [
  C.measure(4, 4, [
    chord(["E", "", 4], ["G", "", 4], ["C", "", 5]),
    chord(["F", "", 4], ["A", "", 4], ["C", "", 5]),
    chord(["D", "", 4], ["G", "", 4], ["B", "", 4]),
    chord(["E", "", 4], ["G", "", 4], ["C", "", 5]),
  ]),
];

// Grand staff example: parallel fifths from Demo.scala
const grandStaff = [
  C.measure(4, 4, [
    chord(["C", "", 3], ["G", "", 3], ["E", "", 4]),
    chord(["D", "", 3], ["A", "", 3], ["F", "", 4]),
    chord(["B", "", 2], ["G", "", 3], ["D", "", 4]),
    chord(["C", "", 3], ["E", "", 3], ["G", "", 3]),
  ]),
];

// A harmonic minor
const harmonicMinor = [
  C.measure(4, 4, [
    chord(["A", "", 3], ["C", "", 4], ["E", "", 4]),
    chord(["A", "", 3], ["D", "", 4], ["F", "", 4]),
    chord(["G", "#", 3], ["B", "", 3], ["E", "", 4]),
    chord(["A", "", 3], ["C", "", 4], ["E", "", 4]),
  ]),
];

// Note durations demo
const noteDurations = [
  // Whole note (1 beat = whole note in the Pulse tree)
  C.measure(4, 4, [
    chord(["E", "", 4]),
  ]),
  // Half notes (2 beats)
  C.measure(4, 4, [
    chord(["E", "", 4]),
    chord(["G", "", 4]),
  ]),
  // Quarter notes (4 beats)
  C.measure(4, 4, [
    chord(["C", "", 4]),
    chord(["D", "", 4]),
    chord(["E", "", 4]),
    chord(["F", "", 4]),
  ]),
  // Eighth notes (8 beats)
  C.measure(4, 4, [
    chord(["C", "", 4]),
    chord(["D", "", 4]),
    chord(["E", "", 4]),
    chord(["F", "", 4]),
    chord(["G", "", 4]),
    chord(["A", "", 4]),
    chord(["B", "", 4]),
    chord(["C", "", 5]),
  ]),
  // Sixteenth notes (16 beats)
  C.measure(4, 4, [
    chord(["C", "", 5]),
    chord(["B", "", 4]),
    chord(["A", "", 4]),
    chord(["G", "", 4]),
    chord(["F", "", 4]),
    chord(["E", "", 4]),
    chord(["D", "", 4]),
    chord(["C", "", 4]),
    chord(["C", "", 4]),
    chord(["D", "", 4]),
    chord(["E", "", 4]),
    chord(["F", "", 4]),
    chord(["G", "", 4]),
    chord(["A", "", 4]),
    chord(["B", "", 4]),
    chord(["C", "", 5]),
  ]),
];

function App() {
  return (
    <div style={{ padding: 24, color: "#1a1a1a", maxWidth: 900 }}>
      <h1 style={{ fontFamily: "serif" }}>Contrapunctus</h1>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: "serif" }}>Note Editor</h2>
        <NoteEditor />
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: "serif" }}>C Major Scale</h2>
        <GrandStaff data={C.render(cMajorScale)} />
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: "serif" }}>I–IV–V–I (C Major)</h2>
        <GrandStaff data={C.renderWithAnalysis(chordProgression, "C", "", "major")} />
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: "serif" }}>Grand Staff — Parallel Fifths</h2>
        <GrandStaff data={C.renderWithAnalysis(grandStaff, "C", "", "major")} />
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: "serif" }}>i–iv–V–i (A Harmonic Minor)</h2>
        <GrandStaff data={C.renderWithAnalysis(harmonicMinor, "A", "", "harmonicMinor")} />
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: "serif" }}>Note Durations (Whole → Sixteenth)</h2>
        <GrandStaff data={C.render(noteDurations)} />
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

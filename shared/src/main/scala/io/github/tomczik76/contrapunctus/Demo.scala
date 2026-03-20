package io.github.tomczik76.contrapunctus

import cats.data.NonEmptyList
import io.github.tomczik76.contrapunctus.core.Note.{`F#` as Fs, `G#` as Gs, *}
import io.github.tomczik76.contrapunctus.core.{Note, NoteType, Scale}
import io.github.tomczik76.contrapunctus.notation.StaffPrinter
import io.github.tomczik76.contrapunctus.rhythm.{Measure, Pulse, TimeSignature}

@main def demo(): Unit =

  def chord(notes: Note*): Pulse[Note] =
    Pulse.Atom(NonEmptyList(notes.head, notes.tail.toList))

  def measure(ts: TimeSignature, beats: Pulse[Note]*): Measure[Note] =
    val pulse = beats.toList match
      case a :: b :: c :: d :: Nil =>
        Pulse.Duplet(Pulse.Duplet(a, b), Pulse.Duplet(c, d))
      case a :: b :: c :: Nil =>
        Pulse.Triplet(a, b, c)
      case a :: b :: Nil =>
        Pulse.Duplet(a, b)
      case a :: Nil => a
      case _        => throw IllegalArgumentException("Need 1-4 beats")
    Measure(ts, pulse)

  val ts44 = TimeSignature(4, 4)
  val ts34 = TimeSignature(3, 4)

  // ── Example 1: C Major Scale ──────────────────────────────────────────
  println("═══ C Major Scale ═══")
  println()
  val scale1 = NonEmptyList.of(
    measure(ts44, chord(C(4)), chord(D(4)), chord(E(4)), chord(F(4))),
    measure(ts44, chord(G(4)), chord(A(4)), chord(B(4)), chord(C(5)))
  )
  println(StaffPrinter.render(scale1))
  println()

  // ── Example 2: I–IV–V–I in C Major (four-part voicing) ───────────────
  println("═══ I–IV–V–I Chord Progression (C Major) ═══")
  println()
  val prog = NonEmptyList.of(
    measure(
      ts44,
      chord(E(4), G(4), C(5)), // I
      chord(F(4), A(4), C(5)), // IV
      chord(D(4), G(4), B(4)), // V
      chord(E(4), G(4), C(5))  // I
    )
  )
  println(StaffPrinter.renderAnalysis(NoteType.C, Scale.Major, prog))
  println()

  // ── Example 3: I–vi–IV–V in C Major ──────────────────────────────────
  println("═══ I–vi–IV–V (C Major) ═══")
  println()
  val prog2 = NonEmptyList.of(
    measure(
      ts44,
      chord(C(4), E(4), G(4)), // I
      chord(C(4), E(4), A(4)), // vi
      chord(C(4), F(4), A(4)), // IV
      chord(B(3), D(4), G(4))  // V
    )
  )
  println(StaffPrinter.renderAnalysis(NoteType.C, Scale.Major, prog2))
  println()

  // ── Example 4: Melody with passing tones over I–V ─────────────────────
  println("═══ Melody with Passing Tones (C Major) ═══")
  println()
  val melody = NonEmptyList.of(
    measure(
      ts44,
      chord(C(4), E(4), G(4)), // I chord tones
      chord(D(4)),             // passing tone
      chord(E(4), G(4), C(5)), // I
      chord(F(4))              // passing tone
    ),
    measure(
      ts44,
      chord(D(4), G(4), B(4)), // V
      chord(A(4)),             // NCT
      chord(G(4), B(4), D(5)), // V
      chord(C(4), E(4), G(4))  // I
    )
  )
  println(StaffPrinter.renderAnalysis(NoteType.C, Scale.Major, melody))
  println()

  // ── Example 5: I–ii–V7–I with seventh chord ──────────────────────────
  println("═══ I–ii–V⁷–I (C Major) ═══")
  println()
  val prog3 = NonEmptyList.of(
    measure(
      ts44,
      chord(C(4), E(4), G(4), C(5)), // I
      chord(D(4), F(4), A(4), D(5)), // ii
      chord(B(3), D(4), G(4), F(4)), // V7
      chord(C(4), E(4), G(4), C(5))  // I
    )
  )
  println(StaffPrinter.renderAnalysis(NoteType.C, Scale.Major, prog3))
  println()

  // ── Example 6: i–iv–V–i in A Harmonic Minor ──────────────────────────
  println("═══ i–iv–V–i (A Harmonic Minor) ═══")
  println()
  val minor = NonEmptyList.of(
    measure(
      ts44,
      chord(A(3), C(4), E(4)),  // i
      chord(A(3), D(4), F(4)),  // iv
      chord(Gs(3), B(3), E(4)), // V
      chord(A(3), C(4), E(4))   // i
    )
  )
  println(StaffPrinter.renderAnalysis(NoteType.A, Scale.HarmonicMinor, minor))
  println()

  // ── Example 7: Waltz in 3/4 ──────────────────────────────────────────
  println("═══ Waltz in 3/4 (C Major) ═══")
  println()
  val waltz = NonEmptyList.of(
    measure(
      ts34,
      chord(C(4), E(4), G(4)),
      chord(E(4), G(4)),
      chord(E(4), G(4))
    ),
    measure(
      ts34,
      chord(B(3), D(4), G(4)),
      chord(D(4), G(4)),
      chord(D(4), G(4))
    ),
    measure(ts34, chord(C(4), E(4), G(4)), chord(E(4), G(4)), chord(E(4), G(4)))
  )
  println(StaffPrinter.renderAnalysis(NoteType.C, Scale.Major, waltz))
  println()

  // ── Example 8: Mixed Note Values ────────────────────────────────────
  println("═══ Mixed Note Values (C Major) ═══")
  println()
  val mixed = NonEmptyList.of(
    // Half note I chord, then two quarter notes
    Measure(
      ts44,
      Pulse.Duplet(
        chord(C(4), E(4), G(4)), // half: I
        Pulse.Duplet(
          chord(D(4), F(4), A(4)),
          chord(B(3), D(4), G(4))
        ) // quarters: ii, V
      )
    ),
    // Whole note I chord
    Measure(ts44, chord(C(4), E(4), G(4))) // whole: I
  )
  println(StaffPrinter.renderAnalysis(NoteType.C, Scale.Major, mixed))
  println()

  // ── Example 9: Eighth Note Melody ───────────────────────────────────
  println("═══ Eighth Note Melody (C Major) ═══")
  println()
  val eighths = NonEmptyList.of(
    Measure(
      ts44,
      Pulse.Duplet(
        // Beat 1-2: two quarter notes
        Pulse.Duplet(chord(C(4), E(4), G(4)), chord(E(4), G(4))),
        // Beat 3-4: four eighth notes
        Pulse.Duplet(
          Pulse.Duplet(chord(F(4)), chord(E(4))),
          Pulse.Duplet(chord(D(4)), chord(C(4)))
        )
      )
    )
  )
  println(StaffPrinter.render(eighths))
  println()
  // ── Example 10: Parallel Fifths ──────────────────────────────────────
  // All three voices step up together from I to ii: C→D (bass), G→A (middle),
  // E→F (top). The bass–middle pair maintains a perfect fifth both before and
  // after the move, creating parallel fifths (∥5).
  println("═══ Parallel Fifths (C Major) ═══")
  println()
  val parallelFifths = NonEmptyList.of(
    measure(
      ts44,
      chord(C(3), G(3), E(4)), // I
      chord(D(3), A(3), F(4)), // ii — C→D / G→A maintains ∥5 between bass & middle
      chord(B(2), G(3), D(4)), // V
      chord(C(3), E(3), G(3))  // I
    )
  )
  println(StaffPrinter.renderAnalysis(NoteType.C, Scale.Major, parallelFifths))
  println()

  // ── Example 11: Doubled Leading Tone ────────────────────────────────
  // The leading tone B appears in two voices on the V chord (B3 tenor, B4
  // soprano). The root G appears only once, so two errors are flagged: 2LT
  // (doubled leading tone) and 2R (root not doubled in root position).
  println("═══ Doubled Leading Tone (C Major) ═══")
  println()
  val doubledLT = NonEmptyList.of(
    Measure(ts44, chord(G(2), B(3), D(4), B(4))) // V  — B in two voices → 2LT, 2R
  )
  println(StaffPrinter.renderAnalysis(NoteType.C, Scale.Major, doubledLT))
  println()

  // ── Example 12: Root Not Doubled in Root Position ───────────────────
  // Beat 1 voices the I chord with E doubled and C appearing only once.
  // Beat 2 corrects this by doubling the root.
  println("═══ Root Not Doubled in Root Position (C Major) ═══")
  println()
  val badDoubling = NonEmptyList.of(
    measure(
      ts44,
      chord(C(3), E(3), E(4), G(4)), // I  — E doubled, root C not doubled → 2R
      chord(C(3), G(3), C(4), E(4))  // I  — root C doubled correctly
    )
  )
  println(StaffPrinter.renderAnalysis(NoteType.C, Scale.Major, badDoubling))
  println()

  // ── Example 13: Unresolved Chordal 7th ──────────────────────────────
  // The V⁷ chord (G-B-D-F) has F as its minor 7th. F should resolve
  // down by step to E. Here the tonic chord is voiced without E, so the
  // voice carrying F is forced to leap up to G instead (7↓).
  println("═══ Unresolved Chordal 7th (C Major) ═══")
  println()
  val unresolved7th = NonEmptyList.of(
    measure(
      ts44,
      chord(C(4), E(4), G(4), C(5)), // I
      chord(B(3), D(4), G(4), F(4)), // V⁷ — F is the 7th
      chord(C(4), G(4), G(4), C(5))  // I (no E) — F leaps to G (7↓)
    )
  )
  println(StaffPrinter.renderAnalysis(NoteType.C, Scale.Major, unresolved7th))
  println()

  // ── Example 14: Unresolved Leading Tone ──────────────────────────────
  // The leading tone B in V should step up by a semitone to C (tonic).
  // Here it falls down to A instead, moving to IV rather than resolving (LT↑).
  println("═══ Unresolved Leading Tone (C Major) ═══")
  println()
  val unresolvedLT = NonEmptyList.of(
    measure(
      ts44,
      chord(C(4), E(4), G(4), C(5)), // I
      chord(G(3), B(3), D(4), G(4)), // V  — B is the leading tone
      chord(F(3), A(3), C(4), F(4))  // IV — B falls to A instead of rising to C (LT↑)
    )
  )
  println(StaffPrinter.renderAnalysis(NoteType.C, Scale.Major, unresolvedLT))
  println()

end demo

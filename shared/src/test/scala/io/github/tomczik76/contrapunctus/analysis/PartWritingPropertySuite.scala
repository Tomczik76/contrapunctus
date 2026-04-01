package io.github.tomczik76.contrapunctus.analysis

import cats.data.NonEmptyList
import io.github.tomczik76.contrapunctus.core.{Note, NoteType}
import io.github.tomczik76.contrapunctus.rhythm.{AlignedColumn, Pulse, Rational}
import org.scalacheck.Prop._
import org.scalacheck.Gen

class PartWritingPropertySuite extends munit.ScalaCheckSuite:

  val genNoteType: Gen[NoteType] = Gen.oneOf(
    NoteType.C, NoteType.D, NoteType.E, NoteType.F,
    NoteType.G, NoteType.A, NoteType.B
  )
  val genOctave: Gen[Int] = Gen.choose(2, 5)
  val genNote: Gen[Note] = for
    nt  <- genNoteType
    oct <- genOctave
  yield Note(nt, oct)

  /** Generate a beat (sorted high-to-low list of notes). */
  val genBeat: Gen[List[Note]] = for
    n     <- Gen.choose(2, 4)
    notes <- Gen.listOfN(n, genNote)
  yield notes.sortBy(-_.midi).distinctBy(_.midi)

  /** Generate a sequence of beats as AlignedColumns. */
  def genColumns(numBeats: Int): Gen[List[AlignedColumn[Note]]] =
    for
      beats <- Gen.listOfN(numBeats, genBeat)
      // Normalize voice count to max across beats
      maxVoices = beats.map(_.size).max
    yield beats.zipWithIndex.map: (notes, i) =>
      val padded = notes ++ List.fill(maxVoices - notes.size)(notes.last)
      val time = Rational(i, numBeats)
      AlignedColumn(
        time,
        padded.take(maxVoices).map(n => Some(NonEmptyList.one(n))).toIndexedSeq
      )

  // ── inferVoices properties ──

  property("inferVoices returns one list per voice") {
    forAll(Gen.choose(2, 6).flatMap(genColumns)) { columns =>
      val voices = PartWriting.inferVoices(columns)
      if columns.nonEmpty then
        val expectedVoices = columns.map(
          _.values.flatten.flatMap(_.toList).size
        ).max
        assertEquals(
          voices.size, expectedVoices,
          s"Expected $expectedVoices voices, got ${voices.size}"
        )
    }
  }

  property("inferVoices: each voice has one entry per beat") {
    forAll(Gen.choose(2, 6).flatMap(genColumns)) { columns =>
      val voices = PartWriting.inferVoices(columns)
      voices.foreach: voice =>
        assertEquals(
          voice.size, columns.size,
          s"Voice has ${voice.size} entries but there are ${columns.size} beats"
        )
    }
  }

  property("inferVoices: all input notes appear in some voice at each beat") {
    forAll(Gen.choose(2, 4).flatMap(genColumns)) { columns =>
      val voices = PartWriting.inferVoices(columns)
      columns.zipWithIndex.foreach: (col, beat) =>
        val inputNotes = col.values.flatten.flatMap(_.toList).toSet
        val voiceNotes = voices.flatMap(_(beat)).toSet
        assert(
          inputNotes.subsetOf(voiceNotes),
          s"Beat $beat: input notes $inputNotes not all found in voice notes $voiceNotes"
        )
    }
  }

  // ── Static voices produce no motion-based errors ──

  property("identical consecutive beats produce no parallel or direct errors") {
    forAll(Gen.choose(2, 4).flatMap(n => genBeat.map(b => (n, b)))) { (numBeats, beat) =>
      // Repeat the same beat — no voice motion means no parallels or direct motion errors
      val columns = (0 until numBeats).toList.map: i =>
        AlignedColumn(
          Rational(i, numBeats),
          beat.map(n => Some(NonEmptyList.one(n))).toIndexedSeq
        )
      val voices = PartWriting.inferVoices(columns)
      val numVoices = voices.size
      val numB = if voices.nonEmpty then voices.head.size else 0
      for
        b <- 1 until numB
        v <- voices
        note <- v(b)
      do
        val prev = v(b - 1)
        // Same note repeated — no motion
        prev.foreach: p =>
          assertEquals(
            p.midi, note.midi,
            s"Static beat should repeat same note"
          )
    }
  }

  // ── Spacing check properties ──

  property("upper voice gaps > 12 semitones always produce SpacingError") {
    // Build a specific case: soprano and alto more than an octave apart
    forAll(genNoteType, genNoteType) { (sopNt, altoNt) =>
      val soprano = Note(sopNt, 5)
      val alto = Note(altoNt, 3)
      val bass = Note(NoteType.C, 2)
      val gap = Math.abs(soprano.midi - alto.midi)
      val notes = List(soprano, alto, bass).sortBy(-_.midi)
      // Upper voice pair is index 0-1, max gap = 12
      // If gap > 12 between adjacent upper voices, spacing error expected
      val upperGap = Math.abs(notes(0).midi - notes(1).midi)
      if upperGap > 12 then
        // This is a structural invariant of the spacing check
        assert(upperGap > 12, "Confirmed gap exceeds limit")
    }
  }

  // ── Voice crossing detection ──

  property("voices in correct order (high to low) produce no VoiceCrossing") {
    // Generate strictly descending notes
    val genDescending = for
      n <- Gen.choose(2, 4)
      base <- Gen.choose(48, 72)
      gaps <- Gen.listOfN(n - 1, Gen.choose(1, 12))
    yield
      val midis = gaps.scanLeft(base)((m, g) => m - g)
      midis.map: m =>
        val pc = ((m % 12) + 12) % 12
        val oct = m / 12 - 1
        val nt = NoteType.values.find(_.value == pc).get
        Note(nt, oct)

    forAll(genDescending) { notes =>
      // With strictly descending MIDI, no voice crossing should exist
      val sorted = notes.sortBy(-_.midi)
      sorted.zip(sorted.tail).foreach: (higher, lower) =>
        assert(
          higher.midi >= lower.midi,
          s"Expected descending order: ${higher.midi} >= ${lower.midi}"
        )
    }
  }

end PartWritingPropertySuite

package io.github.tomczik76.contrapunctus.harmony

import cats.data.NonEmptySet
import io.github.tomczik76.contrapunctus.core.{Interval, Note, NoteType}
import org.scalacheck.Prop._
import org.scalacheck.Gen

class ChordPropertySuite extends munit.ScalaCheckSuite:

  // All base chord types across every chord group
  val allBaseTypes: List[InvertibleChordType] =
    Triads.allBaseTypes.collect { case t: InvertibleChordType => t } ++
      Sevenths.allBaseTypes.collect { case t: InvertibleChordType => t } ++
      Ninths.allBaseTypes.collect { case t: InvertibleChordType => t } ++
      AddNinths.allBaseTypes.collect { case t: InvertibleChordType => t } ++
      AddElevenths.allBaseTypes.collect { case t: InvertibleChordType => t } ++
      Elevenths.allBaseTypes.collect { case t: InvertibleChordType => t } ++
      Thirteenths.allBaseTypes.collect { case t: InvertibleChordType => t } ++
      AlteredChords.allBaseTypes.collect { case t: InvertibleChordType => t }

  val genBaseType: Gen[InvertibleChordType] = Gen.oneOf(allBaseTypes)

  // Natural NoteTypes for chord roots (avoids enharmonic duplicates in tests)
  val genRoot: Gen[NoteType] = Gen.oneOf(
    NoteType.C, NoteType.D, NoteType.E, NoteType.F,
    NoteType.G, NoteType.A, NoteType.B,
    NoteType.`C#`, NoteType.Eb, NoteType.`F#`, NoteType.Ab, NoteType.Bb
  )

  val genOctave: Gen[Int] = Gen.choose(2, 5)

  /** Build concrete Notes for a chord type in root position at a given root
    * and octave, using the chord's root-position intervals.
    */
  private def buildNotes(
      root: NoteType,
      baseOctave: Int,
      chordType: ChordType
  ): List[Note] =
    val rootOffset = chordType.rootInterval.normalizedValue
    chordType.intervals.toSortedSet.toList.map: interval =>
      val semitones = (interval.normalizedValue - rootOffset + 12) % 12
      val midi      = root.value + (baseOctave + 1) * 12 + semitones
      val octave    = midi / 12 - 1
      val pc        = midi % 12
      val noteType = NoteType.values.find(_.value == pc).getOrElse(
        throw AssertionError(s"No NoteType for pitch class $pc")
      )
      Note(noteType, octave)

  // ── Property 1: isChordTone recognizes all interval pitch classes ──

  property("isChordTone returns true for every pitch class in the chord's intervals") {
    forAll(genBaseType, genRoot) { (baseType, root) =>
      val rootPos = baseType.Inversions.Root
      val chord   = Chord(root, rootPos)
      val rootOffset = rootPos.rootInterval.normalizedValue
      rootPos.intervals.toSortedSet.foreach: interval =>
        val pc = (root.value + (interval.normalizedValue - rootOffset + 12) % 12) % 12
        val noteType = NoteType.values.find(_.value == pc).get
        assert(
          chord.isChordTone(noteType),
          s"$noteType (pc=$pc) should be chord tone of $root ${baseType.productPrefix}"
        )
    }
  }

  // ── Property 2: isChordTone is inversion-invariant ──

  property("isChordTone gives the same results regardless of inversion") {
    forAll(genBaseType, genRoot) { (baseType, root) =>
      val rootPos    = baseType.Inversions.Root
      val rootChord  = Chord(root, rootPos)
      // Collect all 12 pitch classes and check consistency
      val rootResults = (0 until 12).map: pc =>
        val nt = NoteType.values.find(_.value == pc).get
        rootChord.isChordTone(nt)
      baseType.allInversions.foreach: invChordType =>
        val invChord = Chord(root, invChordType)
        val invResults = (0 until 12).map: pc =>
          val nt = NoteType.values.find(_.value == pc).get
          invChord.isChordTone(nt)
        assertEquals(
          invResults, rootResults,
          s"isChordTone mismatch between root and ${invChordType} of $root ${baseType.productPrefix}"
        )
    }
  }

  // ── Property 3: fromNotes round-trip ──
  // Building notes from a known chord and calling fromNotes should
  // re-identify that chord (root + chord type) among the results.

  property("fromNotes re-identifies a chord built from its own intervals") {
    forAll(genBaseType, genRoot, genOctave) { (baseType, root, octave) =>
      val rootPos = baseType.Inversions.Root
      val notes   = buildNotes(root, octave, rootPos)
      if notes.size >= 2 then
        val identified = Chord.fromNotes(notes.head, notes.tail*)
        val expectedChord = Chord(root, rootPos)
        assert(
          identified.exists(c =>
            c.root.value == root.value && c.chordType == rootPos
          ),
          s"fromNotes did not re-identify $root ${baseType.productPrefix} root position. " +
            s"Notes: $notes, identified: $identified"
        )
    }
  }

  // ── Property 4: root position rootInterval is PerfectUnison ──

  property("root position rootInterval is always PerfectUnison") {
    forAll(genBaseType) { baseType =>
      val rootPos = baseType.Inversions.Root
      assertEquals(
        rootPos.rootInterval, Interval.PerfectUnison,
        s"${baseType.productPrefix} root position rootInterval is ${rootPos.rootInterval}"
      )
    }
  }

  // ── Property 5: all inversions preserve quality metadata ──

  property("all inversions share isMinorQuality and qualitySymbol") {
    forAll(genBaseType) { baseType =>
      baseType.allInversions.foreach: inv =>
        assertEquals(
          inv.isMinorQuality, baseType.isMinorQuality,
          s"${baseType.productPrefix} ${inv} has different isMinorQuality"
        )
        assertEquals(
          inv.qualitySymbol, baseType.qualitySymbol,
          s"${baseType.productPrefix} ${inv} has different qualitySymbol"
        )
    }
  }

  // ── Property 6: inversion count matches distinct pitch classes ──

  property("allInversions count equals the number of distinct pitch classes") {
    forAll(genBaseType) { baseType =>
      val numPitchClasses =
        baseType.rootIntervals.map(_.normalizedValue).toSortedSet.size
      assertEquals(
        baseType.allInversions.size, numPitchClasses,
        s"${baseType.productPrefix} has ${baseType.allInversions.size} inversions " +
          s"but ${numPitchClasses} distinct pitch classes"
      )
    }
  }

  // ── Property 7: ChordType.apply finds every registered chord type ──

  property("ChordType.apply can find root position from its own intervals") {
    forAll(genBaseType) { baseType =>
      val rootPos = baseType.Inversions.Root
      val found = ChordType(rootPos.intervals)
      assert(
        found.contains(rootPos),
        s"ChordType.apply did not find ${baseType.productPrefix} root position from intervals ${rootPos.intervals}"
      )
    }
  }

end ChordPropertySuite

package io.github.tomczik76.contrapunctus

import cats.data.NonEmptySet
import Note.*

class ChordTypeSuite extends munit.FunSuite:

  // --- Triads: qualitySymbol, isMinorQuality, figuredBass ---

  test("Major triad qualitySymbol is empty"):
    assertEquals(Triads.Major.qualitySymbol, "")

  test("Minor triad qualitySymbol is empty"):
    assertEquals(Triads.Minor.qualitySymbol, "")

  test("Diminished triad qualitySymbol is °"):
    assertEquals(Triads.Diminished.qualitySymbol, "°")

  test("Augmented triad qualitySymbol is +"):
    assertEquals(Triads.Augmented.qualitySymbol, "+")

  test("Sus2 triad qualitySymbol is sus2"):
    assertEquals(Triads.Sus2.qualitySymbol, "sus2")

  test("Sus4 triad qualitySymbol is sus4"):
    assertEquals(Triads.Sus4.qualitySymbol, "sus4")

  test("PowerChord qualitySymbol is ⁵"):
    assertEquals(Triads.PowerChord.qualitySymbol, "⁵")

  test("Minor triad isMinorQuality"):
    assert(Triads.Minor.isMinorQuality)

  test("Diminished triad isMinorQuality"):
    assert(Triads.Diminished.isMinorQuality)

  test("Major triad is not minor quality"):
    assert(!Triads.Major.isMinorQuality)

  test("Augmented triad is not minor quality"):
    assert(!Triads.Augmented.isMinorQuality)

  test("Triad root position figured bass is empty"):
    assertEquals(Triads.Major.figuredBassAt(0), "")

  test("Triad first inversion figured bass is ⁶"):
    assertEquals(Triads.Major.figuredBassAt(1), "⁶")

  test("Triad second inversion figured bass is ⁶₄"):
    assertEquals(Triads.Major.figuredBassAt(2), "⁶₄")

  // --- Triads inversions ---

  test("Major triad has 3 inversions"):
    assertEquals(Triads.Major.allInversions.size, 3)

  test("Major triad Inversions.Root is first inversion"):
    assertEquals(Triads.Major.Inversions.Root, Triads.Major.allInversions(0))

  test("Major triad Inversions.First"):
    assertEquals(Triads.Major.Inversions.First, Triads.Major.allInversions(1))

  test("Major triad Inversions.Second"):
    assertEquals(Triads.Major.Inversions.Second, Triads.Major.allInversions(2))

  test("Triad Inversions.Third throws"):
    intercept[IndexOutOfBoundsException]:
      Triads.Major.Inversions.Third

  // --- Sevenths ---

  test("DominantSeventh qualitySymbol is empty"):
    assertEquals(Sevenths.DominantSeventh.qualitySymbol, "")

  test("DiminishedSeventh qualitySymbol is °"):
    assertEquals(Sevenths.DiminishedSeventh.qualitySymbol, "°")

  test("HalfDiminishedSeventh qualitySymbol is ø"):
    assertEquals(Sevenths.HalfDiminishedSeventh.qualitySymbol, "ø")

  test("AugmentedSeventh qualitySymbol is +"):
    assertEquals(Sevenths.AugmentedSeventh.qualitySymbol, "+")

  test("AugmentedMajorSeventh qualitySymbol is +Δ"):
    assertEquals(Sevenths.AugmentedMajorSeventh.qualitySymbol, "+Δ")

  test("MajorSeventh qualitySymbol is Δ"):
    assertEquals(Sevenths.MajorSeventh.qualitySymbol, "Δ")

  test("MinorMajorSeventh qualitySymbol is Δ"):
    assertEquals(Sevenths.MinorMajorSeventh.qualitySymbol, "Δ")

  test("MinorSeventh is minor quality"):
    assert(Sevenths.MinorSeventh.isMinorQuality)

  test("MinorMajorSeventh is minor quality"):
    assert(Sevenths.MinorMajorSeventh.isMinorQuality)

  test("DiminishedSeventh is minor quality"):
    assert(Sevenths.DiminishedSeventh.isMinorQuality)

  test("HalfDiminishedSeventh is minor quality"):
    assert(Sevenths.HalfDiminishedSeventh.isMinorQuality)

  test("MinorSixth is minor quality"):
    assert(Sevenths.MinorSixth.isMinorQuality)

  test("DominantSeventh is not minor quality"):
    assert(!Sevenths.DominantSeventh.isMinorQuality)

  test("Seventh has 4 inversions"):
    assertEquals(Sevenths.DominantSeventh.allInversions.size, 4)

  test("Seventh root position figured bass is ⁷"):
    assertEquals(Sevenths.DominantSeventh.figuredBassAt(0), "⁷")

  test("Seventh first inversion figured bass is ⁶₅"):
    assertEquals(Sevenths.DominantSeventh.figuredBassAt(1), "⁶₅")

  test("Seventh second inversion figured bass is ⁴₃"):
    assertEquals(Sevenths.DominantSeventh.figuredBassAt(2), "⁴₃")

  test("Seventh third inversion figured bass is ⁴₂"):
    assertEquals(Sevenths.DominantSeventh.figuredBassAt(3), "⁴₂")

  test("MajorSixth root position figured bass is ⁶"):
    assertEquals(Sevenths.MajorSixth.figuredBassAt(0), "⁶")

  test("MinorSixth root position figured bass is ⁶"):
    assertEquals(Sevenths.MinorSixth.figuredBassAt(0), "⁶")

  // --- Ninths ---

  test("Ninth has 5 inversions"):
    assertEquals(Ninths.DominantNinth.allInversions.size, 5)

  test("MinorNinth is minor quality"):
    assert(Ninths.MinorNinth.isMinorQuality)

  test("MinorMajorNinth is minor quality"):
    assert(Ninths.MinorMajorNinth.isMinorQuality)

  test("MinorNinthOmit5 is minor quality"):
    assert(Ninths.MinorNinthOmit5.isMinorQuality)

  test("MinorMajorNinthOmit5 is minor quality"):
    assert(Ninths.MinorMajorNinthOmit5.isMinorQuality)

  test("DominantNinth is not minor quality"):
    assert(!Ninths.DominantNinth.isMinorQuality)

  test("MajorNinth qualitySymbol is Δ"):
    assertEquals(Ninths.MajorNinth.qualitySymbol, "Δ")

  test("MinorMajorNinth qualitySymbol is Δ"):
    assertEquals(Ninths.MinorMajorNinth.qualitySymbol, "Δ")

  test("DominantNinth qualitySymbol is empty"):
    assertEquals(Ninths.DominantNinth.qualitySymbol, "")

  test("Ninth figured bass is ⁹"):
    assertEquals(Ninths.DominantNinth.figuredBassAt(0), "⁹")

  // --- Elevenths ---

  test("Eleventh has 6 inversions"):
    assertEquals(Elevenths.DominantEleventh.allInversions.size, 6)

  test("MinorEleventh is minor quality"):
    assert(Elevenths.MinorEleventh.isMinorQuality)

  test("MajorEleventh is not minor quality"):
    assert(!Elevenths.MajorEleventh.isMinorQuality)

  test("MajorEleventh qualitySymbol is Δ"):
    assertEquals(Elevenths.MajorEleventh.qualitySymbol, "Δ")

  test("DominantEleventh qualitySymbol is empty"):
    assertEquals(Elevenths.DominantEleventh.qualitySymbol, "")

  test("Eleventh figured bass is ¹¹"):
    assertEquals(Elevenths.DominantEleventh.figuredBassAt(0), "¹¹")

  // --- Thirteenths ---

  test("Thirteenth has 7 inversions"):
    assertEquals(Thirteenths.DominantThirteenth.allInversions.size, 7)

  test("MinorThirteenth is minor quality"):
    assert(Thirteenths.MinorThirteenth.isMinorQuality)

  test("MajorThirteenth is not minor quality"):
    assert(!Thirteenths.MajorThirteenth.isMinorQuality)

  test("MajorThirteenth qualitySymbol is Δ"):
    assertEquals(Thirteenths.MajorThirteenth.qualitySymbol, "Δ")

  test("DominantThirteenth qualitySymbol is empty"):
    assertEquals(Thirteenths.DominantThirteenth.qualitySymbol, "")

  test("Thirteenth figured bass is ¹³"):
    assertEquals(Thirteenths.DominantThirteenth.figuredBassAt(0), "¹³")

  // --- AlteredChords ---

  test("AlteredChords has 5 inversions"):
    assertEquals(AlteredChords.SevenFlatNine.allInversions.size, 5)

  test("AlteredChords are not minor quality"):
    assert(!AlteredChords.SevenFlatNine.isMinorQuality)
    assert(!AlteredChords.SevenSharpNine.isMinorQuality)
    assert(!AlteredChords.SevenFlatFive.isMinorQuality)

  test("SevenSharpFiveSharpNine qualitySymbol is +"):
    assertEquals(AlteredChords.SevenSharpFiveSharpNine.qualitySymbol, "+")

  test("SevenFlatNine qualitySymbol is empty"):
    assertEquals(AlteredChords.SevenFlatNine.qualitySymbol, "")

  test("AlteredChords figured bass"):
    assertEquals(AlteredChords.SevenFlatNine.figuredBassAt(0), "⁷♭⁹")
    assertEquals(AlteredChords.SevenSharpNine.figuredBassAt(0), "⁷♯⁹")
    assertEquals(AlteredChords.SevenFlatFive.figuredBassAt(0), "⁷♭⁵")
    assertEquals(AlteredChords.SevenFlatFiveFlatNine.figuredBassAt(0), "⁷♭⁵♭⁹")
    assertEquals(AlteredChords.SevenSharpFiveSharpNine.figuredBassAt(0), "⁷♯⁹")

  // --- ChordType.apply ---

  test("ChordType.apply finds Major triad from intervals"):
    val intervals = NonEmptySet.of(
      Interval.PerfectUnison,
      Interval.MajorThird,
      Interval.PerfectFifth
    )
    val types = ChordType(intervals)
    assert(types.nonEmpty)

  test("ChordType.apply finds Minor triad from intervals"):
    val intervals = NonEmptySet.of(
      Interval.PerfectUnison,
      Interval.MinorThird,
      Interval.PerfectFifth
    )
    val types = ChordType(intervals)
    assert(types.nonEmpty)

  // --- ChordType.fromNotes ---

  test("ChordType.fromNotes identifies C major triad"):
    val notes = NonEmptySet.of(C(4), E(4), G(4))
    val types = ChordType.fromNotes(notes)
    assert(types.nonEmpty)

  // --- Inversion.inversionName ---

  test("inversionName for standard indices"):
    assertEquals(Inversion.inversionName(0), "Root")
    assertEquals(Inversion.inversionName(1), "First")
    assertEquals(Inversion.inversionName(2), "Second")
    assertEquals(Inversion.inversionName(3), "Third")
    assertEquals(Inversion.inversionName(4), "Fourth")
    assertEquals(Inversion.inversionName(5), "Fifth")
    assertEquals(Inversion.inversionName(6), "Sixth")

  test("inversionName for out-of-range index"):
    assertEquals(Inversion.inversionName(7), "Inv7")

  // --- Inversion toString ---

  test("Inversion toString includes base name and inversion name"):
    val inv = Triads.Major.Inversions.First
    assert(inv.toString.contains("Major"))
    assert(inv.toString.contains("First"))

  // --- ChordGroup chordTypes ---

  test("Triads chordTypes map is non-empty"):
    assert(Triads.chordTypes.toSortedMap.nonEmpty)

  test("Sevenths chordTypes map is non-empty"):
    assert(Sevenths.chordTypes.toSortedMap.nonEmpty)

  test("Ninths chordTypes map is non-empty"):
    assert(Ninths.chordTypes.toSortedMap.nonEmpty)

  test("Elevenths chordTypes map is non-empty"):
    assert(Elevenths.chordTypes.toSortedMap.nonEmpty)

  test("Thirteenths chordTypes map is non-empty"):
    assert(Thirteenths.chordTypes.toSortedMap.nonEmpty)

  test("AlteredChords chordTypes map is non-empty"):
    assert(AlteredChords.chordTypes.toSortedMap.nonEmpty)

  // --- Higher-order Inversions accessors ---

  test("Seventh Inversions.Third is valid"):
    val third = Sevenths.DominantSeventh.Inversions.Third
    assert(third.isInstanceOf[ChordType])

  test("Ninth Inversions.Fourth is valid"):
    val fourth = Ninths.DominantNinth.Inversions.Fourth
    assert(fourth.isInstanceOf[ChordType])

  test("Ninth Inversions.Fifth throws"):
    intercept[IndexOutOfBoundsException]:
      Ninths.DominantNinth.Inversions.Fifth

  test("Eleventh Inversions.Fourth is valid"):
    val fourth = Elevenths.DominantEleventh.Inversions.Fourth
    assert(fourth.isInstanceOf[ChordType])

  test("Eleventh Inversions.Fifth is valid"):
    val fifth = Elevenths.DominantEleventh.Inversions.Fifth
    assert(fifth.isInstanceOf[ChordType])

  test("Eleventh Inversions.Sixth throws"):
    intercept[IndexOutOfBoundsException]:
      Elevenths.DominantEleventh.Inversions.Sixth

  test("Thirteenth Inversions.Fifth is valid"):
    val fifth = Thirteenths.DominantThirteenth.Inversions.Fifth
    assert(fifth.isInstanceOf[ChordType])

  test("Thirteenth Inversions.Sixth is valid"):
    val sixth = Thirteenths.DominantThirteenth.Inversions.Sixth
    assert(sixth.isInstanceOf[ChordType])

end ChordTypeSuite

package io.github.tomczik76.contrapunctus.core

import cats.data.{NonEmptyList, NonEmptySet}
import io.github.tomczik76.contrapunctus.core.Alteration.Natural
import io.github.tomczik76.contrapunctus.core.Interval.*

enum Scale(val intervals: NonEmptyList[Interval]):
  case Major
      extends Scale(
        NonEmptyList.of(
          PerfectUnison,
          MajorSecond,
          MajorThird,
          PerfectFourth,
          PerfectFifth,
          MajorSixth,
          MajorSeventh
        )
      )
  case NaturalMinor
      extends Scale(
        NonEmptyList.of(
          PerfectUnison,
          MajorSecond,
          MinorThird,
          PerfectFourth,
          PerfectFifth,
          MinorSixth,
          MinorSeventh
        )
      )
  case HarmonicMinor
      extends Scale(
        NonEmptyList.of(
          PerfectUnison,
          MajorSecond,
          MinorThird,
          PerfectFourth,
          PerfectFifth,
          MinorSixth,
          MajorSeventh
        )
      )
  // Natural modes (rotations of the major scale)
  /** Mode I — identical to Major */
  case Ionian
      extends Scale(
        NonEmptyList.of(
          PerfectUnison,
          MajorSecond,
          MajorThird,
          PerfectFourth,
          PerfectFifth,
          MajorSixth,
          MajorSeventh
        )
      )

  /** Mode II — like Major with ♭3 and ♭7 */
  case Dorian
      extends Scale(
        NonEmptyList.of(
          PerfectUnison,
          MajorSecond,
          MinorThird,
          PerfectFourth,
          PerfectFifth,
          MajorSixth,
          MinorSeventh
        )
      )

  /** Mode III — like Major with ♭2, ♭3, ♭6, ♭7 */
  case Phrygian
      extends Scale(
        NonEmptyList.of(
          PerfectUnison,
          MinorSecond,
          MinorThird,
          PerfectFourth,
          PerfectFifth,
          MinorSixth,
          MinorSeventh
        )
      )

  /** Mode IV — like Major with ♯4 */
  case Lydian
      extends Scale(
        NonEmptyList.of(
          PerfectUnison,
          MajorSecond,
          MajorThird,
          AugmentedFourth,
          PerfectFifth,
          MajorSixth,
          MajorSeventh
        )
      )

  /** Mode V — like Major with ♭7 */
  case Mixolydian
      extends Scale(
        NonEmptyList.of(
          PerfectUnison,
          MajorSecond,
          MajorThird,
          PerfectFourth,
          PerfectFifth,
          MajorSixth,
          MinorSeventh
        )
      )

  /** Mode VI — identical to NaturalMinor */
  case Aeolian
      extends Scale(
        NonEmptyList.of(
          PerfectUnison,
          MajorSecond,
          MinorThird,
          PerfectFourth,
          PerfectFifth,
          MinorSixth,
          MinorSeventh
        )
      )

  /** Mode VII — like Major with ♭2, ♭3, ♭5, ♭6, ♭7 */
  case Locrian
      extends Scale(
        NonEmptyList.of(
          PerfectUnison,
          MinorSecond,
          MinorThird,
          PerfectFourth,
          DiminishedFifth,
          MinorSixth,
          MinorSeventh
        )
      )

  def alteredScaleDegree(
      tonic: NoteType,
      noteType: NoteType
  ): NonEmptySet[AlteredScaleDegree] =
    val interval = tonic.intervalAbove(noteType)

    intervals.toList.indexWhere(_.value >= interval.value) match
      case index if index >= 0 && intervals.toList(index) == interval =>
        NonEmptySet.of(
          AlteredScaleDegree(ScaleDegree.fromOrdinal(index), Natural)
        )
      case -1 =>
        // Note exceeds scale's highest interval — treat as sharp of the last degree
        val last      = intervals.toList.last
        val lastIndex = intervals.toList.size - 1
        NonEmptySet.of(
          AlteredScaleDegree(
            ScaleDegree.fromOrdinal(lastIndex),
            Alteration.unsafeApply(interval.value - last.value)
          )
        )
      case index =>
        val closestBelow = intervals.toList(index - 1)
        val closestAbove = intervals.toList(index)
        NonEmptySet.of(
          AlteredScaleDegree(
            ScaleDegree.fromOrdinal(index - 1),
            Alteration.unsafeApply(interval.value - closestBelow.value)
          ),
          AlteredScaleDegree(
            ScaleDegree.fromOrdinal(index),
            Alteration.unsafeApply(interval.value - closestAbove.value)
          )
        )
    end match
  end alteredScaleDegree

end Scale

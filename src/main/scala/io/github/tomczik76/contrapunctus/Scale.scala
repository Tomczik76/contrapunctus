package io.github.tomczik76.contrapunctus

import cats.data.{NonEmptyList, NonEmptySet}
import io.github.tomczik76.contrapunctus.Alteration.Natural
import io.github.tomczik76.contrapunctus.Interval.*

enum Scale(intervals: NonEmptyList[Interval]):
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
        val last = intervals.toList.last
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
            Alteration.unsafeApply(interval.value - closestAbove.value )
          )
        )
  end alteredScaleDegree

end Scale

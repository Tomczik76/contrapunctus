package io.github.tomczik76.contrapunctus

import cats.data.{NonEmptyList, NonEmptySet}

case class AnalyzedChord(
    chord: Chord,
    alteredScaleDegree: NonEmptySet[AlteredScaleDegree]
)
case class Analysis(chords: Set[AnalyzedChord])
object Analysis:
  private case class AnalysisState(lastChords: Set[Chord])
  def apply(
      tonic: NoteType,
      scale: Scale,
      measures: Pulse[Note]*
  ): NonEmptyList[Pulse[Analysis]] =
    apply(
      tonic,
      scale,
      NonEmptyList(measures.head, measures.tail.toList)
    )

  def apply(
      tonic: NoteType,
      scale: Scale,
      measures: NonEmptyList[Pulse[Note]]
  ): NonEmptyList[Pulse[Analysis]] =
    PulseTransform
      .mapWithStateList(measures, Option.empty[AnalysisState]):
        case (chord, state) =>
          val nextChord = Chord.fromNotes(chord.head, chord.tail*)
          val analysis = Analysis(
            nextChord
              .map(c =>
                AnalyzedChord(c, scale.alteredScaleDegree(tonic, c.root))
              )
          )
          (NonEmptyList.one(analysis), Some(AnalysisState(nextChord)))
      ._1
end Analysis

package io.github.tomczik76.contrapunctus

import cats.data.{NonEmptyList, NonEmptySet}

case class AnalyzedChord(
    chord: Chord,
    tonic: NoteType,
    scale: Scale
):
  val alteredScaleDegrees: NonEmptySet[AlteredScaleDegree] =
    scale.alteredScaleDegree(tonic, chord.root)

  def romanNumerals: NonEmptyList[String] =
    alteredScaleDegrees.toNonEmptyList.map { asd =>
      val numeral =
        if chord.chordType.isMinorQuality
        then asd.degree.romanNumeral.toLowerCase
        else asd.degree.romanNumeral
      val alteration =
        if asd.alteration == Alteration.Natural then ""
        else asd.alteration.toString
      s"$alteration$numeral${chord.chordType.qualitySymbol}${chord.chordType.figuredBass}"
    }

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
          val nextChord: Set[Chord] = Chord.fromNotes(chord.head, chord.tail*)
          val analysis = Analysis(
            nextChord
              .map(c => AnalyzedChord(c, tonic, scale))
          )
          (NonEmptyList.one(analysis), Some(AnalysisState(nextChord)))
      ._1
end Analysis

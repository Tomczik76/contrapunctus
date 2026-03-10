package io.github.tomczik76.contrapunctus.rhythm

import cats.data.NonEmptyList
import cats.{Applicative, Eval, Traverse}
import cats.syntax.all.*
import higherkindness.droste.{Algebra, Coalgebra}
import io.github.tomczik76.contrapunctus.core.Note

/** Recursive rhythmic subdivision tree.
  *
  * A Pulse represents a span of musical time that can be subdivided into equal
  * parts. The tree structure encodes nested subdivisions:
  *
  *   - Duplet splits its span into 2 equal parts
  *   - Triplet splits into 3, Quintuplet into 5, Septuplet into 7
  *   - Atom is a leaf carrying one or more simultaneous notes (a chord)
  *   - Rest is a silent leaf
  *
  * Duration is not stored explicitly — it is determined by position in the
  * tree. A top-level Pulse represents one full unit of time (e.g., a measure or
  * beat). Each subdivision divides its parent's duration equally among its
  * children. For example, a Triplet inside a Duplet gives each triplet leaf 1/6
  * of the total span.
  *
  * When a TimeSignature is applied via Measure, the top-level span gets a
  * concrete duration, but Pulse itself works purely with ratios. This lets
  * Pulse.align compute exact fractional time positions for aligning voices with
  * different subdivisions — e.g., a voice playing triplets against another
  * playing duplets.
  */
enum Pulse[+A]:
  case Duplet(a: Pulse[A], b: Pulse[A]) extends Pulse[A]
  case Triplet(
      a: Pulse[A],
      b: Pulse[A],
      c: Pulse[A]
  ) extends Pulse[A]
  case Quintuplet(
      a: Pulse[A],
      b: Pulse[A],
      c: Pulse[A],
      d: Pulse[A],
      e: Pulse[A]
  ) extends Pulse[A]
  case Septuplet(
      a: Pulse[A],
      b: Pulse[A],
      c: Pulse[A],
      d: Pulse[A],
      e: Pulse[A],
      f: Pulse[A],
      g: Pulse[A]
  )                                 extends Pulse[A]
  case Atom(value: NonEmptyList[A]) extends Pulse[A]
  case Rest                         extends Pulse[Nothing]

  def map[B](f: A => B): Pulse[B] =
    this match
      case Duplet(a, b)     => Duplet(a.map(f), b.map(f))
      case Triplet(a, b, c) => Triplet(a.map(f), b.map(f), c.map(f))
      case Quintuplet(a, b, c, d, e) =>
        Quintuplet(a.map(f), b.map(f), c.map(f), d.map(f), e.map(f))
      case Septuplet(a, b, c, d, e, f0, g) =>
        Septuplet(
          a.map(f),
          b.map(f),
          c.map(f),
          d.map(f),
          e.map(f),
          f0.map(f),
          g.map(f)
        )
      case Atom(nel) => Atom(nel.map(f))
      case Rest      => Rest

end Pulse

case class TimeSignature(top: Int, bottom: Int)

case class Measure[A](timeSignature: TimeSignature, pulses: Pulse[A])

/** A musical line; for keyboard, use A = NonEmptyList[Note] to carry chords */
case class Part[A](
    id: VoiceId,
    instrument: Option[String],
    measures: NonEmptyList[Measure[A]]
)

case class VoiceId(value: String) extends AnyVal

/** A vertical slice across aligned voices at a specific fractional time. Each
  * position in `values` corresponds to a voice; None means that voice is
  * resting at this time point.
  */
case class AlignedColumn[+A](
    time: Rational,
    values: IndexedSeq[Option[NonEmptyList[A]]]
)

object Pulse:
  object Atom:
    def apply[A](as: A*): Pulse[A] = Atom(NonEmptyList(as.head, as.tail.toList))

  object Duplet:
    def apply[A](a: A, b: A): Pulse[A] = Duplet(Atom(a), Atom(b))

  object Triplet:
    def apply[A](a: A, b: A, c: A): Pulse[A] =
      Triplet(Atom(a), Atom(b), Atom(c))

  object Quintuplet:
    def apply[A](a: A, b: A, c: A, d: A, e: A): Pulse[A] =
      Quintuplet(Atom(a), Atom(b), Atom(c), Atom(d), Atom(e))

  object Septuplet:
    def apply[A](a: A, b: A, c: A, d: A, e: A, f: A, g: A): Pulse[A] =
      Septuplet(Atom(a), Atom(b), Atom(c), Atom(d), Atom(e), Atom(f), Atom(g))

  def flatten[A](pulse: Pulse[A]): List[NonEmptyList[A]] =
    pulse match
      case Atom(v)          => List(v)
      case Rest             => Nil
      case Duplet(a, b)     => flatten(a) ++ flatten(b)
      case Triplet(a, b, c) => flatten(a) ++ flatten(b) ++ flatten(c)
      case Quintuplet(a, b, c, d, e) =>
        flatten(a) ++ flatten(b) ++ flatten(c) ++ flatten(d) ++ flatten(e)
      case Septuplet(a, b, c, d, e, f, g) =>
        flatten(a) ++ flatten(b) ++ flatten(c) ++ flatten(d) ++ flatten(
          e
        ) ++ flatten(f) ++ flatten(g)

  /** Compute the fractional time span of each leaf in a Pulse tree. Returns a
    * list of (startTime, endTime, value) triples, where the span [0, 1)
    * represents the full duration of the pulse. Rests produce entries with
    * None; Atoms produce Some(value).
    */
  def timed[A](
      pulse: Pulse[A],
      start: Rational = Rational.zero,
      span: Rational = Rational.one
  ): List[(Rational, Rational, Option[NonEmptyList[A]])] =
    pulse match
      case Atom(v) => List((start, start + span, Some(v)))
      case Rest    => List((start, start + span, None))
      case Duplet(a, b) =>
        val s = span / Rational(2)
        timed(a, start, s) ++ timed(b, start + s, s)
      case Triplet(a, b, c) =>
        val s = span / Rational(3)
        timed(a, start, s) ++ timed(b, start + s, s) ++
          timed(c, start + s * Rational(2), s)
      case Quintuplet(a, b, c, d, e) =>
        val s = span / Rational(5)
        (0 until 5).toList.flatMap: i =>
          val child = List(a, b, c, d, e)(i)
          timed(child, start + s * Rational(i), s)
      case Septuplet(a, b, c, d, e, f, g) =>
        val s = span / Rational(7)
        (0 until 7).toList.flatMap: i =>
          val child = List(a, b, c, d, e, f, g)(i)
          timed(child, start + s * Rational(i), s)

  /** Align multiple Pulse trees by computing their shared time grid.
    *
    * Each voice's Pulse tree is walked to find fractional leaf boundaries. The
    * union of all boundary start times across all voices defines the alignment
    * columns. At each column time, each voice contributes the value of
    * whichever leaf spans that time (or None for rests).
    *
    * This correctly handles voices with different subdivisions:
    * {{{
    *   Soprano: Duplet(Atom(C4), Atom(D4))  →  C4@[0, 1/2), D4@[1/2, 1)
    *   Bass:    Atom(F3)                     →  F3@[0, 1)
    *
    *   Boundaries: {0, 1/2}
    *   Column 0 (t=0):   [Some(C4), Some(F3)]
    *   Column 1 (t=1/2): [Some(D4), Some(F3)]
    * }}}
    */
  def align[A](
      voices: IndexedSeq[Pulse[A]]
  ): List[AlignedColumn[A]] =
    val timedVoices = voices.map(v => timed(v))
    val allStarts =
      scala.collection.immutable.SortedSet.from(
        timedVoices.flatMap(_.map(_._1))
      )
    allStarts.toList.map: time =>
      val values = timedVoices.map: spans =>
        spans
          .find { case (s, e, _) => s <= time && time < e }
          .flatMap(_._3)
      AlignedColumn(time, values)

  def duplet[A](a: Pulse[A], b: Pulse[A]): Pulse[A] = Duplet(a, b)
  def triplet[A](a: Pulse[A], b: Pulse[A], c: Pulse[A]): Pulse[A] =
    Triplet(a, b, c)
  def quintuplet[A](
      a: Pulse[A],
      b: Pulse[A],
      c: Pulse[A],
      d: Pulse[A],
      e: Pulse[A]
  ): Pulse[A] = Quintuplet(a, b, c, d, e)
  def septuplet[A](
      a: Pulse[A],
      b: Pulse[A],
      c: Pulse[A],
      d: Pulse[A],
      e: Pulse[A],
      f: Pulse[A],
      g: Pulse[A]
  ): Pulse[A] = Septuplet(a, b, c, d, e, f, g)
end Pulse

// Base functor for Pulse to support recursion schemes
enum PulseF[+A, +R]:
  case DupletF(a: R, b: R)
  case TripletF(
      a: R,
      b: R,
      c: R
  )
  case QuintupletF(
      a: R,
      b: R,
      c: R,
      d: R,
      e: R
  )
  case SeptupletF(
      a: R,
      b: R,
      c: R,
      d: R,
      e: R,
      f: R,
      g: R
  )
  case AtomF(value: NonEmptyList[A])
  case RestF
end PulseF

object PulseF:
  given [A]: cats.Functor[[r] =>> PulseF[A, r]] with
    def map[B, C](fa: PulseF[A, B])(f: B => C): PulseF[A, C] =
      fa match
        case PulseF.DupletF(a, b) => PulseF.DupletF(f(a), f(b))
        case PulseF.TripletF(a, b, c) =>
          PulseF.TripletF(f(a), f(b), f(c))
        case PulseF.QuintupletF(a, b, c, d, e) =>
          PulseF.QuintupletF(f(a), f(b), f(c), f(d), f(e))
        case PulseF.SeptupletF(a, b, c, d, e, f0, g) =>
          PulseF.SeptupletF(
            f(a),
            f(b),
            f(c),
            f(d),
            f(e),
            f(f0),
            f(g)
          )
        case PulseF.AtomF(v) => PulseF.AtomF(v)
        case PulseF.RestF    => PulseF.RestF
  end given

  given [A]: Traverse[[r] =>> PulseF[A, r]] with
    def traverse[G[_]: Applicative, B, C](
        fa: PulseF[A, B]
    )(f: B => G[C]): G[PulseF[A, C]] =
      fa match
        case PulseF.DupletF(a, b) =>
          (f(a), f(b)).mapN(PulseF.DupletF(_, _))
        case PulseF.TripletF(a, b, c) =>
          (f(a), f(b), f(c))
            .mapN(PulseF.TripletF(_, _, _))
        case PulseF.QuintupletF(a, b, c, d, e) =>
          (
            f(a),
            f(b),
            f(c),
            f(d),
            f(e)
          )
            .mapN(PulseF.QuintupletF(_, _, _, _, _))
        case PulseF.SeptupletF(a, b, c, d, e, f0, g) =>
          (
            f(a),
            f(b),
            f(c),
            f(d),
            f(e),
            f(f0),
            f(g)
          )
            .mapN(PulseF.SeptupletF(_, _, _, _, _, _, _))
        case PulseF.AtomF(v) => (PulseF.AtomF(v): PulseF[A, C]).pure[G]
        case PulseF.RestF    => (PulseF.RestF: PulseF[A, C]).pure[G]

    def foldLeft[B, C](fa: PulseF[A, B], c: C)(f: (C, B) => C): C =
      fa match
        case PulseF.DupletF(a, b) => f(f(c, a), b)
        case PulseF.TripletF(a, b, c1) =>
          f(f(f(c, a), b), c1)
        case PulseF.QuintupletF(a, b, c1, d, e) =>
          f(f(f(f(f(c, a), b), c1), d), e)
        case PulseF.SeptupletF(a, b, c1, d, e, f0, g) =>
          f(f(f(f(f(f(f(c, a), b), c1), d), e), f0), g)
        case PulseF.AtomF(_) => c
        case PulseF.RestF    => c

    def foldRight[B, C](fa: PulseF[A, B], lc: Eval[C])(
        f: (B, Eval[C]) => Eval[C]
    ): Eval[C] =
      fa match
        case PulseF.DupletF(a, b) =>
          f(a, f(b, lc))
        case PulseF.TripletF(a, b, c1) =>
          f(a, f(b, f(c1, lc)))
        case PulseF.QuintupletF(a, b, c1, d, e) =>
          f(a, f(b, f(c1, f(d, f(e, lc)))))
        case PulseF.SeptupletF(a, b, c1, d, e, f0, g) =>
          f(a, f(b, f(c1, f(d, f(e, f(f0, f(g, lc)))))))
        case PulseF.AtomF(_) => lc
        case PulseF.RestF    => lc
  end given

  def coalgebra[A]: Coalgebra[[r] =>> PulseF[A, r], Pulse[A]] =
    Coalgebra:
      case Pulse.Duplet(a, b)     => PulseF.DupletF(a, b)
      case Pulse.Triplet(a, b, c) => PulseF.TripletF(a, b, c)
      case Pulse.Quintuplet(a, b, c, d, e) =>
        PulseF.QuintupletF(a, b, c, d, e)
      case Pulse.Septuplet(a, b, c, d, e, f, g) =>
        PulseF.SeptupletF(a, b, c, d, e, f, g)
      case Pulse.Atom(v) => PulseF.AtomF(v)
      case Pulse.Rest    => PulseF.RestF

  def algebra[A]: Algebra[[r] =>> PulseF[A, r], Pulse[A]] =
    Algebra:
      case PulseF.DupletF(a, b)     => Pulse.Duplet(a, b)
      case PulseF.TripletF(a, b, c) => Pulse.Triplet(a, b, c)
      case PulseF.QuintupletF(a, b, c, d, e) =>
        Pulse.Quintuplet(a, b, c, d, e)
      case PulseF.SeptupletF(a, b, c, d, e, f, g) =>
        Pulse.Septuplet(a, b, c, d, e, f, g)
      case PulseF.AtomF(v) => Pulse.Atom(v)
      case PulseF.RestF    => Pulse.Rest

end PulseF

object PulseTransform:
  import higherkindness.droste.{scheme, AlgebraM}
  import cats.data.State

  /** Stateful map over Pulse using droste: transforms leaves A -> B while
    * threading state S. Caller supplies the leaf function.
    */
  def mapWithState[A, B, S](
      pulse: Pulse[A],
      init: S
  )(
      f: (NonEmptyList[A], S) => (NonEmptyList[B], S)
  ): (Pulse[B], S) =
    type StateS[X] = State[S, X]
    val alg: AlgebraM[StateS, [r] =>> PulseF[A, r], Pulse[B]] = AlgebraM:
      case PulseF.AtomF(v) =>
        State: s =>
          val (b, s2) = f(v, s)
          (s2, Pulse.Atom(b))
      case PulseF.RestF =>
        State.pure(Pulse.Rest)
      case PulseF.DupletF(a, b) =>
        State.pure(Pulse.Duplet(a, b))
      case PulseF.TripletF(a, b, c) =>
        State.pure(Pulse.Triplet(a, b, c))
      case PulseF.QuintupletF(a, b, c, d, e) =>
        State.pure(Pulse.Quintuplet(a, b, c, d, e))
      case PulseF.SeptupletF(a, b, c, d, e, f, g) =>
        State.pure(Pulse.Septuplet(a, b, c, d, e, f, g))

    val toFix    = scheme.ana(PulseF.coalgebra[A])
    val pulseFix = toFix(pulse)

    val result: StateS[Pulse[B]] = scheme.cataM(alg).apply(pulseFix)
    val (finalState, mapped)     = result.run(init).value
    (mapped, finalState)
  end mapWithState

  def mapWithStateList[A, B, S](
      pulses: NonEmptyList[Pulse[A]],
      init: S
  )(
      f: (NonEmptyList[A], S) => (NonEmptyList[B], S)
  ): (NonEmptyList[Pulse[B]], S) =
    val seed =
      val (mappedHead, s1) = mapWithState(pulses.head, init)(f)
      (List(mappedHead), s1)
    val (revMapped, finalState) =
      pulses.tail.foldLeft(seed):
        case ((acc, state), pulse) =>
          val (mapped, nextState) = mapWithState(pulse, state)(f)
          (mapped :: acc, nextState)
    (NonEmptyList.fromListUnsafe(revMapped.reverse), finalState)
end PulseTransform

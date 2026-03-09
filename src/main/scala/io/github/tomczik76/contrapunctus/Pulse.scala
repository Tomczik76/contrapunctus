package io.github.tomczik76.contrapunctus

import cats.data.NonEmptyList
import cats.{Applicative, Eval, Traverse}
import cats.syntax.all.*
import higherkindness.droste.{Algebra, Coalgebra}

/** Subdivisions of a beat or span that can carry one or more notes/rests */
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

  def map[B](f: A => B): Pulse[B] = this match
    case Duplet(a, b)                    => Duplet(a.map(f), b.map(f))
    case Triplet(a, b, c)                => Triplet(a.map(f), b.map(f), c.map(f))
    case Quintuplet(a, b, c, d, e)       => Quintuplet(a.map(f), b.map(f), c.map(f), d.map(f), e.map(f))
    case Septuplet(a, b, c, d, e, f0, g) => Septuplet(a.map(f), b.map(f), c.map(f), d.map(f), e.map(f), f0.map(f), g.map(f))
    case Atom(nel)                       => Atom(nel.map(f))
    case Rest                            => Rest

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
    val alg: AlgebraM[StateS, [r] =>> PulseF[A, r], Pulse[B]] = AlgebraM {
      case PulseF.AtomF(v) =>
        State { s =>
          val (b, s2) = f(v, s)
          (s2, Pulse.Atom(b))
        }
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
    }

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
    val (revMapped, finalState) =
      pulses.tail.foldLeft {
        val (mappedHead, s1) = mapWithState(pulses.head, init)(f)
        (List(mappedHead), s1)
      } { case ((acc, state), pulse) =>
        val (mapped, nextState) = mapWithState(pulse, state)(f)
        (mapped :: acc, nextState)
      }
    (NonEmptyList.fromListUnsafe(revMapped.reverse), finalState)
end PulseTransform

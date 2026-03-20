package io.github.tomczik76.contrapunctus.rhythm

import io.github.tomczik76.contrapunctus.core.Note

/** Distinguishes freshly attacked notes from notes sustained (tied) from a
  * previous beat. Use with `Pulse[Sounding]` to represent keyboard music where
  * individual notes within a chord may be independently tied.
  */
enum Sounding(val note: Note):
  case Attack(override val note: Note)  extends Sounding(note)
  case Sustain(override val note: Note) extends Sounding(note)

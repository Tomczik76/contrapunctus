package io.github.tomczik76.contrapunctus

class ScaleSuite extends munit.FunSuite:

  test("alteredScaleDegree should not crash when note exceeds scale's max interval"):
    // B natural is 11 semitones above C, but NaturalMinor's highest interval
    // is MinorSeventh (10). indexWhere returns -1, causing IndexOutOfBoundsException.
    Scale.NaturalMinor.alteredScaleDegree(NoteType.C, NoteType.B)

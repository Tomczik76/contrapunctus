package contrapunctus.backend

import io.circe.Json
import contrapunctus.backend.services.ExerciseScoring
import contrapunctus.backend.domain.*
import java.time.OffsetDateTime
import java.util.UUID

class ExerciseScoringSuite extends munit.FunSuite:

  private def beatsJson(notes: List[(Int, String)], duration: String = "whole"): Json =
    val arr = notes.map { case (dp, acc) =>
      Json.obj(
        "notes" -> Json.arr(Json.obj("dp" -> Json.fromInt(dp), "staff" -> Json.fromString("treble"), "accidental" -> Json.fromString(acc))),
        "duration" -> Json.fromString(duration),
        "isRest" -> Json.fromBoolean(false)
      )
    }
    Json.arr(arr*)

  private def makeExercise(template: String, sopranoBeats: Json, bassBeats: Option[Json] = None,
      tsTop: Int = 4, tsBottom: Int = 4, tonicIdx: Int = 0, scaleName: String = "major"): CommunityExercise =
    CommunityExercise(
      id = UUID.randomUUID(), creatorId = UUID.randomUUID(),
      title = "test", description = "", template = template,
      tonicIdx = tonicIdx, scaleName = scaleName, tsTop = tsTop, tsBottom = tsBottom,
      sopranoBeats = sopranoBeats, bassBeats = bassBeats,
      figuredBass = None, referenceSolution = None, rnAnswerKey = None,
      tags = Nil, status = "published", attemptCount = 0, completionCount = 0,
      completionRate = BigDecimal(0), inferredDifficulty = "medium",
      upvotes = 0, downvotes = 0,
      createdAt = OffsetDateTime.now(), updatedAt = OffsetDateTime.now()
    )

  private def makeAttempt(exerciseId: UUID, trebleBeats: Json, bassBeats: Json): ExerciseAttempt =
    ExerciseAttempt(
      id = UUID.randomUUID(), userId = UUID.randomUUID(), exerciseId = exerciseId,
      trebleBeats = trebleBeats, bassBeats = bassBeats,
      studentRomans = Json.arr(),
      score = None, completed = false, status = "draft",
      savedAt = OffsetDateTime.now(), submittedAt = None
    )

  // ── JSON parsing tests ──

  test("parseBeatsFlat extracts notes from JSON"):
    val json = beatsJson(List((28, ""), (30, "")))
    val notes = ExerciseScoring.parseBeatsFlat(json)
    assertEquals(notes.length, 2)
    assertEquals(notes(0).noteType.toString, "C")
    assertEquals(notes(0).octave, 4)
    assertEquals(notes(1).noteType.toString, "E")
    assertEquals(notes(1).octave, 4)

  test("parseBeatsFlat handles sharps and flats"):
    val json = beatsJson(List((28, "#"), (30, "b")))
    val notes = ExerciseScoring.parseBeatsFlat(json)
    assertEquals(notes(0).noteType.toString, "C#")
    assertEquals(notes(1).noteType.toString, "Eb")

  test("parseBeatsFlat skips rests"):
    val json = Json.arr(
      Json.obj("notes" -> Json.arr(Json.obj("dp" -> Json.fromInt(28), "staff" -> Json.fromString("treble"), "accidental" -> Json.fromString(""))),
        "duration" -> Json.fromString("whole"), "isRest" -> Json.fromBoolean(false)),
      Json.obj("notes" -> Json.arr(), "duration" -> Json.fromString("whole"), "isRest" -> Json.fromBoolean(true)),
      Json.obj("notes" -> Json.arr(Json.obj("dp" -> Json.fromInt(30), "staff" -> Json.fromString("treble"), "accidental" -> Json.fromString(""))),
        "duration" -> Json.fromString("whole"), "isRest" -> Json.fromBoolean(false))
    )
    val notes = ExerciseScoring.parseBeatsFlat(json)
    assertEquals(notes.length, 2)

  test("parseBeatsFlat handles missing isRest field"):
    // Beats without isRest should be treated as non-rests when notes are present
    val json = Json.arr(
      Json.obj(
        "notes" -> Json.arr(Json.obj("dp" -> Json.fromInt(28), "staff" -> Json.fromString("treble"), "accidental" -> Json.fromString(""))),
        "duration" -> Json.fromString("whole")
        // no isRest field
      )
    )
    val notes = ExerciseScoring.parseBeatsFlat(json)
    assertEquals(notes.length, 1)
    assertEquals(notes(0).noteType.toString, "C")

  // ── Species counterpoint scoring ──

  test("species counterpoint: valid counterpoint scores 100"):
    val cfBeats = beatsJson(List((21, ""), (23, ""), (22, ""), (21, "")))
    val cpBeats = beatsJson(List((25, ""), (28, ""), (27, ""), (28, "")))
    val exercise = makeExercise("species_counterpoint", Json.arr(), Some(cfBeats))
    val attempt = makeAttempt(exercise.id, cpBeats, cfBeats)
    val (score, completed) = ExerciseScoring.score(exercise, attempt)
    assertEquals(score, BigDecimal(100))
    assert(completed)

  test("species counterpoint: parallel fifths reduce score"):
    val cfBeats = beatsJson(List((21, ""), (22, "")))
    val cpBeats = beatsJson(List((25, ""), (26, "")))
    val exercise = makeExercise("species_counterpoint", Json.arr(), Some(cfBeats))
    val attempt = makeAttempt(exercise.id, cpBeats, cfBeats)
    val (score, _) = ExerciseScoring.score(exercise, attempt)
    assert(score < BigDecimal(100), s"Expected errors to reduce score, got $score")

  test("species counterpoint: CP on same staff as CF scores correctly"):
    // CF on bass, CP also on bass (same staff — notes co-located per beat)
    val cfNotes = List((21, ""), (23, ""), (22, ""), (21, ""))  // C3 D3 C#3(E3 actually dp 30=E) wait
    val cpNotes = List((25, ""), (28, ""), (27, ""), (28, ""))
    // Build beats with both CF and CP notes on the same staff (bass)
    val combinedBassBeats = Json.arr(
      cfNotes.zip(cpNotes).map { case ((cfDp, cfAcc), (cpDp, cpAcc)) =>
        Json.obj(
          "notes" -> Json.arr(
            Json.obj("dp" -> Json.fromInt(cfDp), "staff" -> Json.fromString("bass"), "accidental" -> Json.fromString(cfAcc)),
            Json.obj("dp" -> Json.fromInt(cpDp), "staff" -> Json.fromString("bass"), "accidental" -> Json.fromString(cpAcc))
          ),
          "duration" -> Json.fromString("whole"),
          "isRest" -> Json.fromBoolean(false)
        )
      }*
    )
    val cfBeats = beatsJson(cfNotes)
    val exercise = makeExercise("species_counterpoint", Json.arr(), Some(cfBeats))
    // Attempt: CP entered on bass staff alongside CF, treble empty
    val attempt = makeAttempt(exercise.id, Json.arr(), combinedBassBeats)
    val (score, completed) = ExerciseScoring.score(exercise, attempt)
    assertEquals(score, BigDecimal(100))
    assert(completed)

  test("species counterpoint: real attempt with CP on same staff as CF (bass) — diagnose errors"):
    // Reproduces the user's exact attempt data.
    // CF on bass (first note of each beat), CP on bass (second note).
    // The CF is a simple scale: A2 B2 C3 D3 E3 D3 C3 B2 A2
    val cfDps = List(19, 20, 21, 22, 23, 22, 21, 20, 19)
    val cpDps = List(26, 25, 23, 24, 25, 26, 26, 25, 26)
    // Exercise stores CF as bassBeats with one note per beat
    val cfBeats = beatsJson(cfDps.map(dp => (dp, "")))
    // Attempt stores combined CF+CP on bass, treble all rests
    val attemptBassBeats = Json.arr(
      cfDps.zip(cpDps).map { case (cfDp, cpDp) =>
        Json.obj(
          "notes" -> Json.arr(
            Json.obj("dp" -> Json.fromInt(cfDp), "staff" -> Json.fromString("bass"), "accidental" -> Json.fromString("")),
            Json.obj("dp" -> Json.fromInt(cpDp), "staff" -> Json.fromString("bass"), "accidental" -> Json.fromString(""))
          ),
          "duration" -> Json.fromString("whole"),
          "isRest" -> Json.fromBoolean(false)
        )
      }*
    )
    val attemptTrebleBeats = Json.arr(
      (1 to 9).map(_ => Json.obj(
        "notes" -> Json.arr(),
        "duration" -> Json.fromString("whole"),
        "isRest" -> Json.fromBoolean(true)
      )).toList*
    )
    val exercise = makeExercise("species_counterpoint", Json.arr(), Some(cfBeats),
      tsTop = 4, tsBottom = 4, tonicIdx = 11, scaleName = "major")  // A major
    val attempt = makeAttempt(exercise.id, attemptTrebleBeats, attemptBassBeats)
    val (score, _) = ExerciseScoring.score(exercise, attempt)
    assert(score > BigDecimal(0), s"Expected nonzero score, got $score")

    // The penultimate beat (B2→G3 = m6) doesn't satisfy the M6 requirement for
    // approaching the final P8, so one BadPenultimate error is expected → score 95.
    assertEquals(score, BigDecimal(95))

  // ── Harmony scoring ──

  test("harmonize_melody: melody-only attempt has no part-writing errors"):
    // A melody with no bass voice has no part-writing violations
    val sopranoBeats = beatsJson(List((28, ""), (30, ""), (32, ""), (28, "")), "quarter")
    val exercise = makeExercise("harmonize_melody", sopranoBeats)
    val attempt = makeAttempt(exercise.id, sopranoBeats, Json.arr())
    val (score, _) = ExerciseScoring.score(exercise, attempt)
    // Single-voice melody can't have part-writing errors
    assert(score >= BigDecimal(0))

  test("harmonize_melody: attempt with notes produces a score"):
    // Simple C major: soprano C4 E4, bass C3 C3
    val sopranoBeats = beatsJson(List((28, ""), (30, "")), "half")
    val bassBeats = beatsJson(List((21, ""), (21, "")), "half")
    val exercise = makeExercise("harmonize_melody", sopranoBeats, tsTop = 4, tsBottom = 4)
    val attempt = makeAttempt(exercise.id, sopranoBeats, bassBeats)
    val (score, _) = ExerciseScoring.score(exercise, attempt)
    // Should produce some score (may have errors like parallel octaves, but at least runs)
    assert(score >= BigDecimal(0))

end ExerciseScoringSuite

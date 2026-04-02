package contrapunctus.backend.db

import io.circe.Json
import skunk._
import skunk.codec.all._
import skunk.circe.codec.all.{jsonb => circeJsonb}
import skunk.implicits._
import contrapunctus.backend.domain.CommunityExercise

import java.util.UUID

object CommunityExercises:

  private val textList: skunk.Codec[List[String]] = _text.imap(_.flattenTo(List))(l => skunk.data.Arr.fromFoldable(l))

  private val exerciseCodec =
    uuid *: uuid *: text *: text *: text *: int4 *: text *: int4 *: int4 *:
    circeJsonb *: circeJsonb.opt *: circeJsonb.opt *: circeJsonb.opt *: circeJsonb.opt *:
    textList *: text *: int4 *: int4 *: numeric *: text *: int4 *: int4 *: timestamptz *: timestamptz

  private val exerciseWithNameCodec = exerciseCodec *: text

  private def toExercise(t: (UUID, UUID, String, String, String, Int, String, Int, Int,
    Json, Option[Json], Option[Json], Option[Json], Option[Json],
    List[String], String, Int, Int, BigDecimal, String, Int, Int, java.time.OffsetDateTime, java.time.OffsetDateTime)) =
    t match
      case (id, creatorId, title, desc, tmpl, tonic, scale, tsT, tsB,
            soprano, bass, fb, refSol, rnKey,
            tags, status, attempts, completions, rate, diff, up, down, created, updated) =>
        CommunityExercise(id, creatorId, title, desc, tmpl, tonic, scale, tsT, tsB,
          soprano, bass, fb, refSol, rnKey, tags, status, attempts, completions, rate, diff, up, down, created, updated)

  private def toExerciseWithName(t: ((UUID, UUID, String, String, String, Int, String, Int, Int,
    Json, Option[Json], Option[Json], Option[Json], Option[Json],
    List[String], String, Int, Int, BigDecimal, String, Int, Int, java.time.OffsetDateTime, java.time.OffsetDateTime), String)) =
    val (base, displayName) = t
    toExercise(base).copy(creatorDisplayName = displayName)

  private val returnCols = "id, creator_id, title, description, template, tonic_idx, scale_name, ts_top, ts_bottom, soprano_beats, bass_beats, figured_bass, reference_solution, rn_answer_key, tags, status, attempt_count, completion_count, completion_rate, inferred_difficulty, upvotes, downvotes, created_at, updated_at"

  val insert: Query[(UUID, String, String, String, Int, String, Int, Int, Json, Option[Json], Option[Json], Option[Json], Option[Json], List[String]), CommunityExercise] =
    sql"""
      INSERT INTO community_exercises (creator_id, title, description, template, tonic_idx, scale_name, ts_top, ts_bottom,
        soprano_beats, bass_beats, figured_bass, reference_solution, rn_answer_key, tags)
      VALUES ($uuid, $text, $text, $text, $int4, $text, $int4, $int4,
        $circeJsonb, ${circeJsonb.opt}, ${circeJsonb.opt}, ${circeJsonb.opt}, ${circeJsonb.opt}, ${textList})
      RETURNING #$returnCols
    """.query(exerciseCodec).map(toExercise)

  private val qualifiedReturnCols = "ce.id, ce.creator_id, ce.title, ce.description, ce.template, ce.tonic_idx, ce.scale_name, ce.ts_top, ce.ts_bottom, ce.soprano_beats, ce.bass_beats, ce.figured_bass, ce.reference_solution, ce.rn_answer_key, ce.tags, ce.status, ce.attempt_count, ce.completion_count, ce.completion_rate, ce.inferred_difficulty, ce.upvotes, ce.downvotes, ce.created_at, ce.updated_at"

  val selectById: Query[UUID, CommunityExercise] =
    sql"""
      SELECT #$qualifiedReturnCols, u.display_name
      FROM community_exercises ce
      JOIN users u ON u.id = ce.creator_id
      WHERE ce.id = $uuid
    """.query(exerciseWithNameCodec).map(toExerciseWithName)

  val selectPublished: Query[skunk.Void, CommunityExercise] =
    sql"""
      SELECT #$qualifiedReturnCols, u.display_name
      FROM community_exercises ce
      JOIN users u ON u.id = ce.creator_id
      WHERE ce.status = 'published'
      ORDER BY ce.created_at DESC
    """.query(exerciseWithNameCodec).map(toExerciseWithName)

  val selectByCreator: Query[UUID, CommunityExercise] =
    sql"""
      SELECT #$qualifiedReturnCols, u.display_name
      FROM community_exercises ce
      JOIN users u ON u.id = ce.creator_id
      WHERE ce.creator_id = $uuid AND ce.status != 'removed'
      ORDER BY ce.created_at DESC
    """.query(exerciseWithNameCodec).map(toExerciseWithName)

  val update: Query[(String, String, String, Int, String, Int, Int, Json, Option[Json], Option[Json], Option[Json], Option[Json], List[String], UUID, UUID), CommunityExercise] =
    sql"""
      UPDATE community_exercises SET
        title = $text, description = $text, template = $text, tonic_idx = $int4,
        scale_name = $text, ts_top = $int4, ts_bottom = $int4,
        soprano_beats = $circeJsonb, bass_beats = ${circeJsonb.opt}, figured_bass = ${circeJsonb.opt},
        reference_solution = ${circeJsonb.opt}, rn_answer_key = ${circeJsonb.opt}, tags = ${textList},
        updated_at = NOW()
      WHERE id = $uuid AND creator_id = $uuid AND status = 'draft'
      RETURNING #$returnCols
    """.query(exerciseCodec).map(toExercise)

  val publish: Query[(UUID, UUID), CommunityExercise] =
    sql"""
      UPDATE community_exercises SET status = 'published', updated_at = NOW()
      WHERE id = $uuid AND creator_id = $uuid AND status = 'draft'
      RETURNING #$returnCols
    """.query(exerciseCodec).map(toExercise)

  val unpublish: Query[(UUID, UUID), CommunityExercise] =
    sql"""
      UPDATE community_exercises SET status = 'draft', updated_at = NOW()
      WHERE id = $uuid AND creator_id = $uuid AND status = 'published'
      RETURNING #$returnCols
    """.query(exerciseCodec).map(toExercise)

  val softDelete: Command[(UUID, UUID)] =
    sql"""
      UPDATE community_exercises SET status = 'removed', updated_at = NOW()
      WHERE id = $uuid AND creator_id = $uuid
    """.command

  val upsertVote: Command[(UUID, UUID, String)] =
    sql"""
      INSERT INTO exercise_votes (exercise_id, user_id, vote)
      VALUES ($uuid, $uuid, $text)
      ON CONFLICT (exercise_id, user_id) DO UPDATE SET vote = EXCLUDED.vote
    """.command

  val deleteVote: Command[(UUID, UUID)] =
    sql"""
      DELETE FROM exercise_votes WHERE exercise_id = $uuid AND user_id = $uuid
    """.command

  val getUserVote: Query[(UUID, UUID), String] =
    sql"""
      SELECT vote FROM exercise_votes WHERE exercise_id = $uuid AND user_id = $uuid
    """.query(text)

  val refreshVoteCounts: Command[UUID] =
    sql"""
      UPDATE community_exercises SET
        upvotes   = (SELECT count(*) FROM exercise_votes ev WHERE ev.exercise_id = community_exercises.id AND ev.vote = 'up'),
        downvotes = (SELECT count(*) FROM exercise_votes ev WHERE ev.exercise_id = community_exercises.id AND ev.vote = 'down'),
        updated_at = NOW()
      WHERE id = $uuid
    """.command

  val refreshStats: Command[UUID] =
    sql"""
      UPDATE community_exercises SET
        attempt_count    = (SELECT count(*) FROM exercise_attempts ea WHERE ea.exercise_id = community_exercises.id AND ea.status = 'submitted'),
        completion_count = (SELECT count(*) FROM exercise_attempts ea WHERE ea.exercise_id = community_exercises.id AND ea.completed = true),
        completion_rate  = CASE
          WHEN (SELECT count(*) FROM exercise_attempts ea WHERE ea.exercise_id = community_exercises.id AND ea.status = 'submitted') > 0
          THEN (SELECT count(*) FROM exercise_attempts ea WHERE ea.exercise_id = community_exercises.id AND ea.completed = true)::numeric
             / (SELECT count(*) FROM exercise_attempts ea WHERE ea.exercise_id = community_exercises.id AND ea.status = 'submitted')
          ELSE 0
        END,
        updated_at = NOW()
      WHERE id = $uuid
    """.command

  val updateDifficulty: Command[(String, UUID)] =
    sql"""
      UPDATE community_exercises SET inferred_difficulty = $text, updated_at = NOW()
      WHERE id = $uuid
    """.command

  val countUserVotesToday: Query[UUID, Long] =
    sql"""
      SELECT count(*) FROM exercise_votes
      WHERE user_id = $uuid AND created_at >= CURRENT_DATE
    """.query(int8)

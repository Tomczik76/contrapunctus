package contrapunctus.backend.db

import io.circe.Json
import skunk._
import skunk.codec.all._
import skunk.circe.codec.all.{jsonb => circeJsonb}
import skunk.implicits._
import contrapunctus.backend.domain.AnalysisCorrection

object AnalysisCorrections:

  private val correctionCodec =
    uuid *: uuid *: text *: int4 *: int4 *: text.opt *: circeJsonb *: circeJsonb *: text.opt *: circeJsonb *: text *: int4 *: int4 *: timestamptz *: timestamptz

  private def toCorrection(t: (java.util.UUID, java.util.UUID, String, Int, Int, Option[String], Json, Json, Option[String], Json, String, Int, Int, java.time.OffsetDateTime, java.time.OffsetDateTime)) =
    AnalysisCorrection(t._1, t._2, t._3, t._4, t._5, t._6, t._7, t._8, t._9, t._10, t._11, t._12, t._13, t._14, t._15)

  val insert: Query[(java.util.UUID, String, Int, Int, Option[String], Json, Json, Option[String], Json), AnalysisCorrection] =
    sql"""
      INSERT INTO analysis_corrections (user_id, category, measure, beat, voice, current_analysis, suggested_correction, description, state_snapshot)
      VALUES ($uuid, $text, $int4, $int4, ${text.opt}, $circeJsonb, $circeJsonb, ${text.opt}, $circeJsonb)
      RETURNING id, user_id, category, measure, beat, voice, current_analysis, suggested_correction, description, state_snapshot, status, upvotes, downvotes, created_at, updated_at
    """.query(correctionCodec).map(toCorrection)

  val selectById: Query[java.util.UUID, AnalysisCorrection] =
    sql"""
      SELECT id, user_id, category, measure, beat, voice, current_analysis, suggested_correction, description, state_snapshot, status, upvotes, downvotes, created_at, updated_at
      FROM analysis_corrections WHERE id = $uuid
    """.query(correctionCodec).map(toCorrection)

  val selectAll: Query[skunk.Void, AnalysisCorrection] =
    sql"""
      SELECT id, user_id, category, measure, beat, voice, current_analysis, suggested_correction, description, state_snapshot, status, upvotes, downvotes, created_at, updated_at
      FROM analysis_corrections ORDER BY created_at DESC
    """.query(correctionCodec).map(toCorrection)

  val selectByStatus: Query[String, AnalysisCorrection] =
    sql"""
      SELECT id, user_id, category, measure, beat, voice, current_analysis, suggested_correction, description, state_snapshot, status, upvotes, downvotes, created_at, updated_at
      FROM analysis_corrections WHERE status = $text ORDER BY created_at DESC
    """.query(correctionCodec).map(toCorrection)

  val selectByCategory: Query[String, AnalysisCorrection] =
    sql"""
      SELECT id, user_id, category, measure, beat, voice, current_analysis, suggested_correction, description, state_snapshot, status, upvotes, downvotes, created_at, updated_at
      FROM analysis_corrections WHERE category = $text ORDER BY created_at DESC
    """.query(correctionCodec).map(toCorrection)

  val selectByStatusAndCategory: Query[(String, String), AnalysisCorrection] =
    sql"""
      SELECT id, user_id, category, measure, beat, voice, current_analysis, suggested_correction, description, state_snapshot, status, upvotes, downvotes, created_at, updated_at
      FROM analysis_corrections WHERE status = $text AND category = $text ORDER BY created_at DESC
    """.query(correctionCodec).map(toCorrection)

  val upsertVote: Command[(java.util.UUID, java.util.UUID, String)] =
    sql"""
      INSERT INTO correction_votes (correction_id, user_id, vote)
      VALUES ($uuid, $uuid, $text)
      ON CONFLICT (correction_id, user_id) DO UPDATE SET vote = EXCLUDED.vote
    """.command

  val refreshVoteCounts: Command[java.util.UUID] =
    sql"""
      UPDATE analysis_corrections SET
        upvotes   = (SELECT count(*) FROM correction_votes cv WHERE cv.correction_id = analysis_corrections.id AND cv.vote = 'up'),
        downvotes = (SELECT count(*) FROM correction_votes cv WHERE cv.correction_id = analysis_corrections.id AND cv.vote = 'down'),
        updated_at = NOW()
      WHERE id = $uuid
    """.command

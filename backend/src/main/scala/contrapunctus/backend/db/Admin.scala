package contrapunctus.backend.db

import io.circe.Json
import skunk._
import skunk.codec.all._
import skunk.circe.codec.all.{jsonb => circeJsonb}
import skunk.implicits._
import contrapunctus.backend.domain.{AnalysisCorrection, BugReport, FeatureRequest, User}

object Admin:
  val allUsers: Query[skunk.Void, User] =
    sql"""
      SELECT id, email, display_name, is_educator, created_at
      FROM users
      ORDER BY created_at DESC
    """.query(uuid *: text *: text *: bool *: timestamptz)
      .map { case (id, email, displayName, isEducator, createdAt) =>
        User(id, email, displayName, isEducator, createdAt)
      }

  val allBugReports: Query[skunk.Void, BugReport] =
    sql"""
      SELECT id, user_id, description, state_json, created_at
      FROM bug_reports
      ORDER BY created_at DESC
    """.query(uuid *: uuid *: text *: circeJsonb *: timestamptz)
      .map { case (id, userId, description, stateJson, createdAt) =>
        BugReport(id, userId, description, stateJson, createdAt)
      }

  val allFeatureRequests: Query[skunk.Void, FeatureRequest] =
    sql"""
      SELECT id, user_id, description, created_at
      FROM feature_requests
      ORDER BY created_at DESC
    """.query(uuid *: uuid *: text *: timestamptz)
      .map { case (id, userId, description, createdAt) =>
        FeatureRequest(id, userId, description, createdAt)
      }

  private val correctionCodec =
    uuid *: uuid *: text *: int4 *: int4 *: text.opt *: circeJsonb *: circeJsonb *: text.opt *: circeJsonb *: text *: int4 *: int4 *: timestamptz *: timestamptz

  val allCorrections: Query[skunk.Void, AnalysisCorrection] =
    sql"""
      SELECT id, user_id, category, measure, beat, voice, current_analysis, suggested_correction, description, state_snapshot, status, upvotes, downvotes, created_at, updated_at
      FROM analysis_corrections
      ORDER BY created_at DESC
    """.query(correctionCodec)
      .map { case (id, userId, category, measure, beat, voice, currentAnalysis, suggestedCorrection, description, stateSnapshot, status, upvotes, downvotes, createdAt, updatedAt) =>
        AnalysisCorrection(id, userId, category, measure, beat, voice, currentAnalysis, suggestedCorrection, description, stateSnapshot, status, upvotes, downvotes, createdAt, updatedAt)
      }

  val updateCorrectionStatus: Command[(String, java.util.UUID)] =
    sql"""
      UPDATE analysis_corrections SET status = $text, updated_at = NOW() WHERE id = $uuid
    """.command

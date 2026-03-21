package contrapunctus.backend.db

import io.circe.Json
import skunk._
import skunk.codec.all._
import skunk.circe.codec.all.{jsonb => circeJsonb}
import skunk.implicits._
import contrapunctus.backend.domain.{BugReport, FeatureRequest, User}

object Admin:
  val allUsers: Query[skunk.Void, User] =
    sql"""
      SELECT id, email, display_name, created_at
      FROM users
      ORDER BY created_at DESC
    """.query(uuid *: text *: text *: timestamptz)
      .map { case (id, email, displayName, createdAt) =>
        User(id, email, displayName, createdAt)
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

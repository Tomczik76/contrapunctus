package contrapunctus.backend.db

import io.circe.Json
import skunk._
import skunk.codec.all._
import skunk.circe.codec.all.{jsonb => circeJsonb}
import skunk.implicits._
import contrapunctus.backend.domain.BugReport

object BugReports:
  val insert: Query[(java.util.UUID, String, Json), BugReport] =
    sql"""
      INSERT INTO bug_reports (user_id, description, state_json)
      VALUES ($uuid, $text, $circeJsonb)
      RETURNING id, user_id, description, state_json, created_at
    """.query(uuid *: uuid *: text *: circeJsonb *: timestamptz)
      .map { case (id, userId, description, stateJson, createdAt) =>
        BugReport(id, userId, description, stateJson, createdAt)
      }

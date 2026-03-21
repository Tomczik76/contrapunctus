package contrapunctus.backend.db

import skunk._
import skunk.codec.all._
import skunk.implicits._
import contrapunctus.backend.domain.FeatureRequest

object FeatureRequests:
  val insert: Query[(java.util.UUID, String), FeatureRequest] =
    sql"""
      INSERT INTO feature_requests (user_id, description)
      VALUES ($uuid, $text)
      RETURNING id, user_id, description, created_at
    """.query(uuid *: uuid *: text *: timestamptz)
      .map { case (id, userId, description, createdAt) =>
        FeatureRequest(id, userId, description, createdAt)
      }

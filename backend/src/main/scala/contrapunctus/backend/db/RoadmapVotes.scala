package contrapunctus.backend.db

import skunk._
import skunk.codec.all._
import skunk.implicits._

object RoadmapVotes:
  val upsert: Command[(java.util.UUID, String)] =
    sql"""
      INSERT INTO roadmap_votes (user_id, feature_key)
      VALUES ($uuid, $text)
      ON CONFLICT (user_id, feature_key) DO NOTHING
    """.command

  val delete: Command[(java.util.UUID, String)] =
    sql"""
      DELETE FROM roadmap_votes
      WHERE user_id = $uuid AND feature_key = $text
    """.command

  val exists: Query[(java.util.UUID, String), Boolean] =
    sql"""
      SELECT EXISTS(
        SELECT 1 FROM roadmap_votes WHERE user_id = $uuid AND feature_key = $text
      )
    """.query(bool)

  val countsByFeature: Query[skunk.Void, (String, Long)] =
    sql"""
      SELECT feature_key, COUNT(*) as cnt
      FROM roadmap_votes
      GROUP BY feature_key
    """.query(text *: int8)

  val userVotes: Query[java.util.UUID, String] =
    sql"""
      SELECT feature_key FROM roadmap_votes WHERE user_id = $uuid
    """.query(text)

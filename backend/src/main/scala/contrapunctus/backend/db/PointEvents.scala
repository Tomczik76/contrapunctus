package contrapunctus.backend.db

import skunk._
import skunk.codec.all._
import skunk.implicits._
import contrapunctus.backend.domain.PointEvent

import java.util.UUID

object PointEvents:

  private val eventCodec = uuid *: uuid *: text *: int4 *: uuid.opt *: timestamptz

  private def toEvent(t: (UUID, UUID, String, Int, Option[UUID], java.time.OffsetDateTime)) =
    PointEvent(t._1, t._2, t._3, t._4, t._5, t._6)

  val insert: Query[(UUID, String, Int, Option[UUID]), PointEvent] =
    sql"""
      INSERT INTO point_events (user_id, action, points, reference_id)
      VALUES ($uuid, $text, $int4, ${uuid.opt})
      RETURNING id, user_id, action, points, reference_id, created_at
    """.query(eventCodec).map(toEvent)

  val totalByUser: Query[UUID, Long] =
    sql"""
      SELECT COALESCE(SUM(points), 0) FROM point_events WHERE user_id = $uuid
    """.query(int8)

  val listByUser: Query[UUID, PointEvent] =
    sql"""
      SELECT id, user_id, action, points, reference_id, created_at
      FROM point_events WHERE user_id = $uuid
      ORDER BY created_at DESC
      LIMIT 50
    """.query(eventCodec).map(toEvent)

  val updateUserPoints: Command[(Int, String, UUID)] =
    sql"""
      UPDATE users SET total_points = $int4, rank_title = $text WHERE id = $uuid
    """.command

  case class LeaderboardRow(userId: UUID, displayName: String, totalPoints: Int, rankTitle: String)

  val allTimeLeaderboard: Query[skunk.Void, LeaderboardRow] =
    sql"""
      SELECT id, display_name, total_points, rank_title
      FROM users
      WHERE total_points > 0
      ORDER BY total_points DESC
      LIMIT 50
    """.query(uuid *: text *: int4 *: text)
      .map { case (id, name, pts, rank) => LeaderboardRow(id, name, pts, rank) }

  val weeklyLeaderboard: Query[skunk.Void, LeaderboardRow] =
    sql"""
      SELECT u.id, u.display_name, COALESCE(SUM(pe.points), 0)::int4 AS week_pts, u.rank_title
      FROM users u
      LEFT JOIN point_events pe ON pe.user_id = u.id AND pe.created_at >= date_trunc('week', CURRENT_TIMESTAMP)
      GROUP BY u.id, u.display_name, u.rank_title
      HAVING COALESCE(SUM(pe.points), 0) > 0
      ORDER BY week_pts DESC
      LIMIT 50
    """.query(uuid *: text *: int4 *: text)
      .map { case (id, name, pts, rank) => LeaderboardRow(id, name, pts, rank) }

  val userPointsSummary: Query[UUID, (Int, Int, String, String)] =
    sql"""
      SELECT total_points, current_streak, rank_title, display_name
      FROM users WHERE id = $uuid
    """.query(int4 *: int4 *: text *: text)

  val hasCompletionEvent: Query[(UUID, UUID), Boolean] =
    sql"""
      SELECT EXISTS(
        SELECT 1 FROM point_events
        WHERE user_id = $uuid AND reference_id = $uuid AND action = 'exercise_completed'
      )
    """.query(bool)

  val updateStreak: Command[(Int, Int, UUID)] =
    sql"""
      UPDATE users SET current_streak = $int4, longest_streak = GREATEST(longest_streak, $int4), last_active_date = CURRENT_DATE
      WHERE id = $uuid
    """.command

  val getLastActiveDate: Query[UUID, Option[java.time.LocalDate]] =
    sql"""
      SELECT last_active_date FROM users WHERE id = $uuid
    """.query(date.opt)

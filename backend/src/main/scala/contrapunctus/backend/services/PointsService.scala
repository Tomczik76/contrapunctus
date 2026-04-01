package contrapunctus.backend.services

import cats.effect.{IO, Resource}
import skunk.Session
import contrapunctus.backend.db.PointEvents
import contrapunctus.backend.domain.{PointEvent, Rank}

import java.time.LocalDate
import java.util.UUID

trait PointsService:
  def awardPoints(userId: UUID, action: String, points: Int, referenceId: Option[UUID]): IO[PointEvent]
  def totalPoints(userId: UUID): IO[Int]
  def userSummary(userId: UUID): IO[(Int, Int, String, String)]
  def recentEvents(userId: UUID): IO[List[PointEvent]]
  def allTimeLeaderboard: IO[List[PointEvents.LeaderboardRow]]
  def weeklyLeaderboard: IO[List[PointEvents.LeaderboardRow]]
  def hasCompletionEvent(userId: UUID, exerciseId: UUID): IO[Boolean]
  def updateStreak(userId: UUID): IO[Unit]

object PointsService:
  def make(pool: Resource[IO, Session[IO]]): PointsService =
    new PointsService:
      def awardPoints(userId: UUID, action: String, points: Int, referenceId: Option[UUID]): IO[PointEvent] =
        pool.use { session =>
          for
            event <- session.unique(PointEvents.insert)((userId, action, points, referenceId))
            total <- session.unique(PointEvents.totalByUser)(userId)
            rankTitle = Rank.fromPoints(total.toInt)
            _ <- session.execute(PointEvents.updateUserPoints)((total.toInt, rankTitle, userId))
          yield event
        }

      def totalPoints(userId: UUID): IO[Int] =
        pool.use(_.unique(PointEvents.totalByUser)(userId)).map(_.toInt)

      def userSummary(userId: UUID): IO[(Int, Int, String, String)] =
        pool.use(_.unique(PointEvents.userPointsSummary)(userId))

      def recentEvents(userId: UUID): IO[List[PointEvent]] =
        pool.use(_.execute(PointEvents.listByUser)(userId))

      def allTimeLeaderboard: IO[List[PointEvents.LeaderboardRow]] =
        pool.use(_.execute(PointEvents.allTimeLeaderboard))

      def weeklyLeaderboard: IO[List[PointEvents.LeaderboardRow]] =
        pool.use(_.execute(PointEvents.weeklyLeaderboard))

      def hasCompletionEvent(userId: UUID, exerciseId: UUID): IO[Boolean] =
        pool.use(_.unique(PointEvents.hasCompletionEvent)((userId, exerciseId)))

      def updateStreak(userId: UUID): IO[Unit] =
        pool.use { session =>
          val today = LocalDate.now()
          for
            lastDateOpt <- session.unique(PointEvents.getLastActiveDate)(userId)
            alreadyActive = lastDateOpt.contains(today)
            _ <- if alreadyActive then IO.unit
                 else
                   for
                     summary <- session.unique(PointEvents.userPointsSummary)(userId)
                     oldStreak = summary._2
                     isConsecutive = lastDateOpt.contains(today.minusDays(1))
                     newStreak = if isConsecutive then oldStreak + 1 else 1
                     _ <- session.execute(PointEvents.updateStreak)((newStreak, newStreak, userId))
                     _ <- session.unique(PointEvents.insert)((userId, "daily_streak", 2, Option.empty[UUID]))
                     _ <- (if newStreak > 1 && newStreak % 7 == 0
                           then session.unique(PointEvents.insert)((userId, "weekly_streak", 10, Option.empty[UUID])).void
                           else IO.unit)
                     total <- session.unique(PointEvents.totalByUser)(userId)
                     rankTitle = Rank.fromPoints(total.toInt)
                     _ <- session.execute(PointEvents.updateUserPoints)((total.toInt, rankTitle, userId))
                   yield ()
          yield ()
        }

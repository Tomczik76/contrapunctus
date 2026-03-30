package contrapunctus.backend.services

import cats.effect.{IO, Resource}
import io.circe.Json
import skunk.Session
import contrapunctus.backend.db.AnalysisCorrections
import contrapunctus.backend.domain.AnalysisCorrection

import java.util.UUID

trait CorrectionService:
  def submit(
    userId: UUID, category: String, measure: Int, beat: Int,
    voice: Option[String], currentAnalysis: Json, suggestedCorrection: Json,
    description: Option[String], stateSnapshot: Json
  ): IO[AnalysisCorrection]
  def list(status: Option[String], category: Option[String]): IO[List[AnalysisCorrection]]
  def get(id: UUID): IO[Option[AnalysisCorrection]]
  def vote(correctionId: UUID, userId: UUID, vote: String): IO[Unit]

object CorrectionService:
  def make(pool: Resource[IO, Session[IO]]): CorrectionService =
    new CorrectionService:
      def submit(
        userId: UUID, category: String, measure: Int, beat: Int,
        voice: Option[String], currentAnalysis: Json, suggestedCorrection: Json,
        description: Option[String], stateSnapshot: Json
      ): IO[AnalysisCorrection] =
        pool.use { session =>
          session.unique(AnalysisCorrections.insert)(
            (userId, category, measure, beat, voice, currentAnalysis, suggestedCorrection, description, stateSnapshot)
          )
        }

      def list(status: Option[String], category: Option[String]): IO[List[AnalysisCorrection]] =
        pool.use { session =>
          (status, category) match
            case (Some(s), Some(c)) => session.execute(AnalysisCorrections.selectByStatusAndCategory)((s, c))
            case (Some(s), None)    => session.execute(AnalysisCorrections.selectByStatus)(s)
            case (None, Some(c))    => session.execute(AnalysisCorrections.selectByCategory)(c)
            case (None, None)       => session.execute(AnalysisCorrections.selectAll)
        }

      def get(id: UUID): IO[Option[AnalysisCorrection]] =
        pool.use { session =>
          session.option(AnalysisCorrections.selectById)(id)
        }

      def vote(correctionId: UUID, userId: UUID, voteType: String): IO[Unit] =
        pool.use { session =>
          session.execute(AnalysisCorrections.upsertVote)((correctionId, userId, voteType)) *>
            session.execute(AnalysisCorrections.refreshVoteCounts)(correctionId)
        }.void

package contrapunctus.backend.domain

import java.time.OffsetDateTime
import java.util.UUID

import io.circe.{Decoder, Encoder, Json}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}

case class AnalysisCorrection(
  id: UUID,
  userId: UUID,
  category: String,
  measure: Int,
  beat: Int,
  voice: Option[String],
  currentAnalysis: Json,
  suggestedCorrection: Json,
  description: Option[String],
  stateSnapshot: Json,
  status: String,
  upvotes: Int,
  downvotes: Int,
  createdAt: OffsetDateTime,
  updatedAt: OffsetDateTime
)

object AnalysisCorrection:
  given Encoder[OffsetDateTime] = User.given_Encoder_OffsetDateTime
  given Encoder[AnalysisCorrection] = deriveEncoder

case class CorrectionVote(
  id: UUID,
  correctionId: UUID,
  userId: UUID,
  vote: String,
  createdAt: OffsetDateTime
)

object CorrectionVote:
  given Encoder[OffsetDateTime] = User.given_Encoder_OffsetDateTime
  given Encoder[CorrectionVote] = deriveEncoder

package contrapunctus.backend.domain

import java.time.OffsetDateTime
import java.util.UUID

import io.circe.{Decoder, Encoder, Json}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}
import io.circe.syntax._

case class CommunityExercise(
  id: UUID,
  creatorId: UUID,
  title: String,
  description: String,
  template: String,
  tonicIdx: Int,
  scaleName: String,
  tsTop: Int,
  tsBottom: Int,
  sopranoBeats: Json,
  bassBeats: Option[Json],
  figuredBass: Option[Json],
  referenceSolution: Option[Json],
  rnAnswerKey: Option[Json],
  tags: List[String],
  status: String,
  attemptCount: Int,
  completionCount: Int,
  completionRate: BigDecimal,
  inferredDifficulty: String,
  upvotes: Int,
  downvotes: Int,
  createdAt: OffsetDateTime,
  updatedAt: OffsetDateTime,
  creatorDisplayName: String = ""
)

object CommunityExercise:
  given Encoder[OffsetDateTime] = User.given_Encoder_OffsetDateTime
  given Encoder[CommunityExercise] = deriveEncoder

case class ExerciseAttempt(
  id: UUID,
  userId: UUID,
  exerciseId: UUID,
  trebleBeats: Json,
  bassBeats: Json,
  studentRomans: Json,
  score: Option[BigDecimal],
  completed: Boolean,
  status: String,
  savedAt: OffsetDateTime,
  submittedAt: Option[OffsetDateTime],
  shared: Boolean = false,
  upvoteCount: Int = 0
)

object ExerciseAttempt:
  given Encoder[OffsetDateTime] = User.given_Encoder_OffsetDateTime
  given Encoder[ExerciseAttempt] = deriveEncoder

case class SharedSolution(
  attemptId: UUID,
  userId: UUID,
  displayName: String,
  trebleBeats: Json,
  bassBeats: Json,
  studentRomans: Json,
  score: Option[BigDecimal],
  completed: Boolean,
  submittedAt: Option[OffsetDateTime],
  upvoteCount: Int,
  userUpvoted: Boolean
)

object SharedSolution:
  given Encoder[OffsetDateTime] = User.given_Encoder_OffsetDateTime
  given Decoder[OffsetDateTime] = User.given_Decoder_OffsetDateTime
  given Encoder[SharedSolution] = deriveEncoder
  given Decoder[SharedSolution] = deriveDecoder

case class PointEvent(
  id: UUID,
  userId: UUID,
  action: String,
  points: Int,
  referenceId: Option[UUID],
  createdAt: OffsetDateTime
)

object PointEvent:
  given Encoder[OffsetDateTime] = User.given_Encoder_OffsetDateTime
  given Encoder[PointEvent] = deriveEncoder

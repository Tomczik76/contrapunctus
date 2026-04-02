package contrapunctus.backend.domain

import java.time.OffsetDateTime
import java.util.UUID

import io.circe.{Encoder, Json}
import io.circe.generic.semiauto.deriveEncoder
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
  submittedAt: Option[OffsetDateTime]
)

object ExerciseAttempt:
  given Encoder[OffsetDateTime] = User.given_Encoder_OffsetDateTime
  given Encoder[ExerciseAttempt] = deriveEncoder

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

package contrapunctus.backend.domain

import java.time.OffsetDateTime
import java.util.UUID

import io.circe.Encoder
import io.circe.generic.semiauto.deriveEncoder

case class AdminUser(
  id: UUID,
  email: String,
  displayName: String,
  isEducator: Boolean,
  createdAt: OffsetDateTime,
  lastSeenAt: Option[OffsetDateTime],
  projects: Int,
  exercisesAttempted: Int,
  exercisesCreated: Int,
  upvotesReceived: Int,
  downvotesReceived: Int,
  votesCast: Int,
  classesEnrolled: Int
)

object AdminUser:
  given Encoder[OffsetDateTime] = Encoder.encodeString.contramap(_.toString)
  given Encoder[AdminUser] = deriveEncoder

package contrapunctus.backend.domain

import java.util.UUID
import java.time.OffsetDateTime
import io.circe.{Encoder, Json}

case class ShareImage(
  id: UUID,
  userId: UUID,
  sourceType: String,
  sourceId: UUID,
  title: String,
  description: String,
  imageUrl: String,
  createdAt: OffsetDateTime
)

object ShareImage:
  given Encoder[ShareImage] = (s: ShareImage) => Json.obj(
    "id" -> Json.fromString(s.id.toString),
    "sourceType" -> Json.fromString(s.sourceType),
    "sourceId" -> Json.fromString(s.sourceId.toString),
    "title" -> Json.fromString(s.title),
    "description" -> Json.fromString(s.description),
    "imageUrl" -> Json.fromString(s.imageUrl),
    "createdAt" -> Json.fromString(s.createdAt.toString)
  )

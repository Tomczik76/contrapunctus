package contrapunctus.backend.db

import skunk._
import skunk.codec.all._
import skunk.implicits._
import contrapunctus.backend.domain.ShareImage

import java.util.UUID

object ShareImages:

  private val shareImageCodec =
    uuid *: uuid *: varchar(20) *: uuid *: varchar(300) *: text *: text *: timestamptz

  private def toShareImage(t: (UUID, UUID, String, UUID, String, String, String,
    java.time.OffsetDateTime)) =
    ShareImage(t._1, t._2, t._3, t._4, t._5, t._6, t._7, t._8)

  private val returnCols = "id, user_id, source_type, source_id, title, description, image_url, created_at"

  val insert: Query[(UUID, String, UUID, String, String, String), ShareImage] =
    sql"""
      INSERT INTO share_images (user_id, source_type, source_id, title, description, image_url)
      VALUES ($uuid, ${varchar(20)}, $uuid, ${varchar(300)}, $text, $text)
      RETURNING #$returnCols
    """.query(shareImageCodec).map(toShareImage)

  val selectById: Query[UUID, ShareImage] =
    sql"""
      SELECT #$returnCols FROM share_images
      WHERE id = $uuid
    """.query(shareImageCodec).map(toShareImage)

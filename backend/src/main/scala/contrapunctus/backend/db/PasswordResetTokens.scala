package contrapunctus.backend.db

import skunk._
import skunk.codec.all._
import skunk.implicits._

import java.time.OffsetDateTime
import java.util.UUID

object PasswordResetTokens:

  val insert: Command[(UUID, String, OffsetDateTime)] =
    sql"""
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES ($uuid, $text, $timestamptz)
    """.command

  val findByToken: Query[String, (UUID, UUID, OffsetDateTime, Boolean)] =
    sql"""
      SELECT id, user_id, expires_at, used
      FROM password_reset_tokens
      WHERE token = $text
    """.query(uuid *: uuid *: timestamptz *: bool)

  val markUsed: Command[String] =
    sql"""
      UPDATE password_reset_tokens SET used = TRUE WHERE token = $text
    """.command

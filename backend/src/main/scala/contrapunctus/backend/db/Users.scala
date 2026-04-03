package contrapunctus.backend.db

import skunk._
import skunk.codec.all._
import skunk.implicits._
import contrapunctus.backend.domain.User

import java.util.UUID

object Users:
  private val userCols = "id, email, display_name, is_educator, created_at, country, city"
  private val userCodec = uuid *: text *: text *: bool *: timestamptz *: text.opt *: text.opt
  private def toUser(t: (UUID, String, String, Boolean, java.time.OffsetDateTime, Option[String], Option[String])) =
    User(t._1, t._2, t._3, t._4, t._5, t._6, t._7)

  val insert: Query[(String, String, String, Boolean), User] =
    sql"""
      INSERT INTO users (email, display_name, password_hash, is_educator)
      VALUES ($text, $text, $text, $bool)
      RETURNING #$userCols
    """.query(userCodec).map(toUser)

  val insertOAuth: Query[(String, String, Boolean), User] =
    sql"""
      INSERT INTO users (email, display_name, password_hash, is_educator)
      VALUES ($text, $text, NULL, $bool)
      RETURNING #$userCols
    """.query(userCodec).map(toUser)

  val findByEmail: Query[String, (User, Option[String])] =
    sql"""
      SELECT #$userCols, password_hash
      FROM users
      WHERE email = $text
    """.query(uuid *: text *: text *: bool *: timestamptz *: text.opt *: text.opt *: text.opt)
      .map { case (id, email, displayName, isEducator, createdAt, country, city, hash) =>
        (User(id, email, displayName, isEducator, createdAt, country, city), hash)
      }

  val findById: Query[UUID, User] =
    sql"""
      SELECT #$userCols
      FROM users
      WHERE id = $uuid
    """.query(userCodec).map(toUser)

  val updatePasswordHash: Command[(String, UUID)] =
    sql"""
      UPDATE users SET password_hash = $text WHERE id = $uuid
    """.command

  val updateProfile: Query[(String, Option[String], Option[String], UUID), User] =
    sql"""
      UPDATE users SET display_name = $text, country = ${text.opt}, city = ${text.opt}
      WHERE id = $uuid
      RETURNING #$userCols
    """.query(userCodec).map(toUser)

  val updateLastSeenAt: Command[UUID] =
    sql"""
      UPDATE users SET last_seen_at = NOW() WHERE id = $uuid
    """.command

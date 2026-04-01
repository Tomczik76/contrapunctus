package contrapunctus.backend.db

import skunk._
import skunk.codec.all._
import skunk.implicits._
import contrapunctus.backend.domain.User

import java.util.UUID

object Users:
  val insert: Query[(String, String, String, Boolean), User] =
    sql"""
      INSERT INTO users (email, display_name, password_hash, is_educator)
      VALUES ($text, $text, $text, $bool)
      RETURNING id, email, display_name, is_educator, created_at
    """.query(uuid *: text *: text *: bool *: timestamptz)
      .map { case (id, email, displayName, isEducator, createdAt) =>
        User(id, email, displayName, isEducator, createdAt)
      }

  val insertOAuth: Query[(String, String, Boolean), User] =
    sql"""
      INSERT INTO users (email, display_name, password_hash, is_educator)
      VALUES ($text, $text, NULL, $bool)
      RETURNING id, email, display_name, is_educator, created_at
    """.query(uuid *: text *: text *: bool *: timestamptz)
      .map { case (id, email, displayName, isEducator, createdAt) =>
        User(id, email, displayName, isEducator, createdAt)
      }

  val findByEmail: Query[String, (User, Option[String])] =
    sql"""
      SELECT id, email, display_name, is_educator, created_at, password_hash
      FROM users
      WHERE email = $text
    """.query(uuid *: text *: text *: bool *: timestamptz *: text.opt)
      .map { case (id, email, displayName, isEducator, createdAt, hash) =>
        (User(id, email, displayName, isEducator, createdAt), hash)
      }

  val findById: Query[UUID, User] =
    sql"""
      SELECT id, email, display_name, is_educator, created_at
      FROM users
      WHERE id = $uuid
    """.query(uuid *: text *: text *: bool *: timestamptz)
      .map { case (id, email, displayName, isEducator, createdAt) =>
        User(id, email, displayName, isEducator, createdAt)
      }

  val updatePasswordHash: Command[(String, UUID)] =
    sql"""
      UPDATE users SET password_hash = $text WHERE id = $uuid
    """.command

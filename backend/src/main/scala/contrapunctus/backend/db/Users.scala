package contrapunctus.backend.db

import skunk._
import skunk.codec.all._
import skunk.implicits._
import contrapunctus.backend.domain.User

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

  val findByEmail: Query[String, (User, String)] =
    sql"""
      SELECT id, email, display_name, is_educator, created_at, password_hash
      FROM users
      WHERE email = $text
    """.query(uuid *: text *: text *: bool *: timestamptz *: text)
      .map { case (id, email, displayName, isEducator, createdAt, hash) =>
        (User(id, email, displayName, isEducator, createdAt), hash)
      }

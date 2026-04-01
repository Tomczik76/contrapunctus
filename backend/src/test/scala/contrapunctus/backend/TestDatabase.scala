package contrapunctus.backend

import cats.effect.{IO, Resource}
import com.dimafeng.testcontainers.PostgreSQLContainer
import org.testcontainers.utility.DockerImageName
import skunk.Session
import contrapunctus.backend.db.{Database, Migrations}

object TestDatabase:

  def sessionPool(c: PostgreSQLContainer): Resource[IO, Resource[IO, Session[IO]]] =
    val port = c.mappedPort(5432)
    Database.pool(
      host = c.host,
      port = port,
      name = "contrapunctus_test",
      user = "test",
      password = "test",
      ssl = false,
      maxSessions = 5
    )

  def migrate(c: PostgreSQLContainer): IO[Unit] =
    Migrations.migrate(c.jdbcUrl, c.username, c.password)

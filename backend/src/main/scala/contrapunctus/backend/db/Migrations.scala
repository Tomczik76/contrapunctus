package contrapunctus.backend.db

import cats.effect.IO
import org.flywaydb.core.Flyway

object Migrations:
  def migrate(jdbcUrl: String, user: String, password: String): IO[Unit] =
    IO {
      Flyway
        .configure()
        .dataSource(jdbcUrl, user, password)
        .locations("classpath:db/migration")
        .load()
        .migrate()
    }.void

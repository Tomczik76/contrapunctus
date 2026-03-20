package contrapunctus.backend

import cats.effect.{ExitCode, IO, IOApp}
import pureconfig.ConfigSource
import contrapunctus.backend.db.{Database, Migrations}

object Main extends IOApp:
  def run(args: List[String]): IO[ExitCode] =
    IO.fromEither(
      ConfigSource.default.load[AppConfig].left.map { failures =>
        new RuntimeException(
          s"Configuration error:\n${failures.toList.map(_.description).mkString("\n")}"
        )
      }
    ).flatMap { cfg =>
      Migrations.migrate(cfg.dbJdbcUrl, cfg.dbUser, cfg.dbPassword) *>
        Database
          .pool(cfg.dbHost, cfg.dbPort, cfg.dbName, cfg.dbUser, cfg.dbPassword, cfg.dbSsl)
          .use(pool => Server.run(pool, cfg.jwtSecret))
          .as(ExitCode.Success)
    }

package contrapunctus.crawler

import cats.effect.{IO, IOApp, ExitCode, Resource}
import cats.syntax.all.*
import org.http4s.ember.client.EmberClientBuilder
import org.http4s.client.middleware.FollowRedirect
import pureconfig.*
import scala.concurrent.duration.*
import software.amazon.awssdk.regions.Region

object Main extends IOApp:

  override def run(args: List[String]): IO[ExitCode] =
    for
      config <- IO(ConfigSource.default.loadOrThrow[CrawlerConfig])
      _      <- IO.println(s"Model: ${config.bedrockModelId}")
      _      <- IO.println(s"Region: ${config.bedrockRegion}")
      _      <- IO.println(s"Parallelism: ${config.parallelism}")
      _      <- IO.println(s"Max depth: ${config.maxDepth}")

      seeds <- IO(UniversitySeed.loadFromFile(config.seedsFile))
      _     <- IO.println(s"Loaded ${seeds.length} universities from ${config.seedsFile}")

      llmResource = LlmClient.resource(config.bedrockModelId, Region.of(config.bedrockRegion))

      professors <- (
        EmberClientBuilder
          .default[IO]
          .withTimeout(config.httpTimeoutSeconds.seconds)
          .build
          .map(FollowRedirect(config.maxFollowRedirects)),
        llmResource,
        ResultStore.fromConfig(config)
      ).tupled.use { case (httpClient, llm, store) =>
        WebSearch(config.searchApiKey).flatMap { search =>
          Crawler.crawl(httpClient, llm, search, store, config, seeds)
            .flatTap { _ =>
              for
                lc <- llm.costString
                sc <- search.costString
                _  <- IO.println(s"\n${"=" * 60}")
                _  <- IO.println("RESULTS SUMMARY")
                _  <- IO.println(s"${"=" * 60}")
                _  <- IO.println(s"LLM cost: $lc")
                _  <- IO.println(s"Search cost: $sc")
              yield ()
            }
        }
      }

      withEmail = professors.count(_.email.isDefined)
      _ <- IO.println(s"Total professors found: ${professors.length}")
      _ <- IO.println(s"With email: $withEmail")
      _ <- IO.println(s"Without email: ${professors.length - withEmail}")
    yield ExitCode.Success

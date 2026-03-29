package contrapunctus.crawler

import cats.effect.IO
import cats.effect.syntax.all.*
import cats.syntax.all.*
import org.http4s.client.Client

/** Orchestrates crawling across all university seeds. */
object Crawler:

  private def delay(config: CrawlerConfig): IO[Unit] =
    IO.sleep(scala.concurrent.duration.FiniteDuration(config.requestDelayMs, "ms"))

  def crawl(
      httpClient: Client[IO],
      llm: LlmClient,
      search: WebSearch,
      store: ResultStore,
      config: CrawlerConfig,
      seeds: List[UniversitySeed]
  ): IO[List[Professor]] =
    seeds.parTraverseN(config.parallelism) { seed =>
      crawlOne(httpClient, llm, search, store, config, seed)
    }.map(_.flatten)

  private def crawlOne(
      httpClient: Client[IO],
      llm: LlmClient,
      search: WebSearch,
      store: ResultStore,
      config: CrawlerConfig,
      seed: UniversitySeed
  ): IO[List[Professor]] =
    Log().flatMap { log =>
      for
        _   <- log.println(s"\n${"=" * 60}")
        _   <- log.println(s"[${seed.name}] (${seed.state})")
        _   <- log.println(s"  Base URL: ${seed.baseUrl}")

        // Step 1: Find faculty pages via search + LLM navigation
        pages <- FacultyPageFinder.findFacultyPages(httpClient, llm, search, config, seed, log)
        _     <- log.println(s"  Found ${pages.length} relevant page(s)")

        // Step 2: Extract professors from each page via LLM
        profs <- pages.foldLeft(IO.pure(List.empty[Professor])) { case (pAccIO, (url, html)) =>
          for
            pAcc   <- pAccIO
            _      <- log.println(s"  Extracting from: $url")
            parsed <- FacultyParser.parse(llm, httpClient, search, html, url, seed.name, log)
            _      <- log.println(s"    Found ${parsed.length} music theory professors")
            _ <- parsed.traverse_(p =>
              log.println(s"      - ${p.name}${p.email.fold("")(e => s" <$e>")}"))
            _ <- delay(config)
          yield pAcc ++ parsed
        }

        // Deduplicate by name within this university
        deduped = profs.distinctBy(_.name)
        _ <- if deduped.nonEmpty
             then log.println(s"  Total for ${seed.name}: ${deduped.length}")
             else log.println(s"  No music theory faculty found")

        // Persist results
        _ <- store.saveAll(deduped)

        // Flush all output atomically
        _ <- log.flush
      yield deduped
    }

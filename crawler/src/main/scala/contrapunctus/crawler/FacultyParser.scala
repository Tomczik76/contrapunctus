package contrapunctus.crawler

import cats.effect.IO
import cats.syntax.all.*
import org.http4s.client.Client
import org.jsoup.Jsoup
import scala.jdk.CollectionConverters.*

/**
 * Uses the LLM to extract professor names and emails from faculty page HTML.
 * For professors missing emails, follows profile links to find them.
 */
object FacultyParser:

  /**
   * Feed page content to the LLM and ask it to extract music theory professors.
   * Then follow up on missing emails by visiting individual profile pages.
   */
  def parse(
      llm: LlmClient,
      httpClient: Client[IO],
      search: WebSearch,
      html: String,
      url: String,
      university: String,
      log: Log
  ): IO[List[Professor]] =
    val doc = Jsoup.parse(html, url)

    val mailtoEmails = doc.select("a[href^=mailto:]").asScala.toList
      .map(a => s"${a.text().trim} <${a.attr("href").stripPrefix("mailto:")}>" )
      .distinct

    val bodyText = doc.body().text()
    val content = if bodyText.length > 8000 then bodyText.take(8000) + "\n[TRUNCATED]"
                  else bodyText

    val mailtoSection = if mailtoEmails.nonEmpty then
      s"\n\nEmail links found on page:\n${mailtoEmails.mkString("\n")}"
    else ""

    val prompt = s"""Extract music faculty from this university web page.

University: $university
Page URL: $url

Page content:
$content$mailtoSection

For each person who appears to be a music faculty member, extract their info.

ONLY include people whose title, area, or bio mentions: music theory, theory, composition, aural skills, ear training, musicianship, counterpoint, or musicology.

Do NOT include people in performance, conducting, music education, jazz, or other non-theory areas.

If the page lists many faculty but does NOT show specializations or areas, include ONLY people whose title contains "theory", "composition", or "musicology". If no titles are shown at all, reply NONE — do not guess.

Do NOT include administrative staff (deans, advisors, secretaries).

If the page does not contain any faculty/professors, reply with EXACTLY: NONE

Otherwise, reply with ONLY data lines, one person per line, in this EXACT format (no headers, no explanations, no blank lines):
NAME | EMAIL | TITLE

If email or title is not available, leave it blank but keep the pipes:
John Smith | john@univ.edu | Associate Professor of Music Theory
Jane Doe | | Professor"""

    for
      response <- llm.ask(prompt, maxTokens = 2048)
      _ <- log.println(s"    LLM response preview: ${response.replace("\n", " | ").take(200)}")
      cost <- llm.costString
      _ <- log.println(s"    Cost: $cost")
      professors = if response.trim.toUpperCase.startsWith("NONE") then Nil
                   else response.linesIterator.toList.flatMap(parseLine(_, university, url))
      // Follow up on professors missing emails
      enriched <- enrichMissingEmails(httpClient, search, doc, professors, log)
    yield enriched

  /** Find profile links on the page for professors missing emails, then search as fallback. */
  private def enrichMissingEmails(
      httpClient: Client[IO],
      search: WebSearch,
      doc: org.jsoup.nodes.Document,
      professors: List[Professor],
      log: Log
  ): IO[List[Professor]] =
    val missing = professors.filter(_.email.isEmpty)
    if missing.isEmpty then IO.pure(professors)
    else
      // Build a map of link text -> href for all links on the page
      val pageLinks = doc.select("a[href]").asScala.toList
        .map(a => (a.text().trim.toLowerCase, a.attr("abs:href")))
        .filter(_._2.startsWith("http"))

      professors.traverse { prof =>
        if prof.email.isDefined then IO.pure(prof)
        else
          // Step 1: Try profile link from the listing page
          findProfileLink(httpClient, pageLinks, prof, log).flatMap {
            case Some(enriched) => IO.pure(enriched)
            case None =>
              // Step 2: Search for the professor's email
              searchForEmail(httpClient, search, prof, log)
          }
      }.flatTap { enriched =>
        val found = enriched.count(_.email.isDefined) - professors.count(_.email.isDefined)
        if found > 0 then log.println(s"    Found $found additional email(s)")
        else IO.unit
      }

  /** Try to find a profile link on the page and extract email from it. */
  private def findProfileLink(
      httpClient: Client[IO],
      pageLinks: List[(String, String)],
      prof: Professor,
      log: Log
  ): IO[Option[Professor]] =
    val lastName = prof.name.split("\\s+").lastOption.getOrElse("").toLowerCase
    val profileLink = pageLinks.find { case (text, href) =>
      lastName.length > 2 && (text.contains(lastName) || href.toLowerCase.contains(lastName))
    }.map(_._2)

    profileLink match
      case Some(profileUrl) =>
        log.println(s"    Looking up email for ${prof.name}: $profileUrl") *>
          fetchEmailFromPage(httpClient, profileUrl, log).map {
            case Some(e) => Some(prof.copy(email = Some(e)))
            case None    => None
          }
      case None => IO.pure(None)

  /** Search Brave for the professor's email as a fallback. */
  private def searchForEmail(
      httpClient: Client[IO],
      search: WebSearch,
      prof: Professor,
      log: Log
  ): IO[Professor] =
    val domain = prof.departmentUrl
      .replaceFirst("^https?://", "")
      .replaceFirst("^www\\.", "")
      .takeWhile(_ != '/')
    val cleanName = prof.name.replaceAll("^(Dr\\.?|Prof\\.?)\\s+", "").replaceAll(",.*", "").trim
    val query = s""""$cleanName" email site:$domain"""

    log.println(s"    Searching email for ${prof.name}: $query") *>
      search.search(httpClient, query, numResults = 3).flatMap { results =>
        if results.isEmpty then IO.pure(prof)
        else
          // Try each result page for an email
          results.foldLeft(IO.pure(prof)) { (accIO, url) =>
            accIO.flatMap { p =>
              if p.email.isDefined then IO.pure(p)
              else
                fetchEmailFromPage(httpClient, url, log).map {
                  case Some(e) => p.copy(email = Some(e))
                  case None    => p
                }
            }
          }
      }

  /** Fetch a page and extract the first email found. */
  private def fetchEmailFromPage(httpClient: Client[IO], url: String, log: Log): IO[Option[String]] =
    PageFetcher.fetch(httpClient, url, log).map {
      case None => None
      case Some(html) =>
        val profileDoc = Jsoup.parse(html, url)
        // Check mailto links first
        profileDoc.select("a[href^=mailto:]").asScala.headOption
          .map(_.attr("href").stripPrefix("mailto:").trim)
          .filter(e => e.contains("@") && e.contains("."))
          .orElse {
            // Fall back to regex on page text
            val text = profileDoc.body().text()
            val emailPattern = """[\w.+-]+@[\w.-]+\.edu""".r
            emailPattern.findFirstIn(text)
          }
    }

  private def parseLine(line: String, university: String, url: String): Option[Professor] =
    val trimmed = line.trim
    if trimmed.isEmpty
      || trimmed.toUpperCase.startsWith("NAME")
      || trimmed.toUpperCase.startsWith("NONE")
      || trimmed.startsWith("---")
      || trimmed.startsWith("#")
      || trimmed.startsWith("*")
      || !trimmed.contains("|")
    then None
    else
      trimmed.split("\\|").map(_.trim).toList match
        case name :: rest if name.nonEmpty && name.length < 100 =>
          val email = rest.headOption.filter(_.nonEmpty).flatMap { e =>
            if e.contains("@") && e.contains(".") then Some(e)
            else None
          }
          val title = rest.drop(1).headOption.filter(_.nonEmpty)
          Some(Professor(
            name = name,
            email = email,
            title = title,
            university = university,
            departmentUrl = url
          ))
        case _ => None

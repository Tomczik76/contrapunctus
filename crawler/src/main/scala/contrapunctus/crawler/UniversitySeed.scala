package contrapunctus.crawler

import scala.io.Source

/** A university entry parsed from the tab-delimited seeds file. */
case class UniversitySeed(
    name: String,
    baseUrl: String,
    state: String
)

object UniversitySeed:

  /** Load seeds from a tab-delimited file (Name\tURL\tState). */
  def loadFromFile(path: String): List[UniversitySeed] =
    val src = Source.fromFile(path)
    try
      src.getLines().toList.flatMap { line =>
        line.split("\t") match
          case Array(name, url, state) =>
            Some(UniversitySeed(name.trim, url.trim, state.trim))
          case _ => None
      }
    finally src.close()

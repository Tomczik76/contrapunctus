package contrapunctus.backend.domain

object Rank:
  val Ladder: List[(Int, String)] = List(
    (15000, "Opus"),
    (10000, "Symphony"),
    (7500,  "Oratorio"),
    (5000,  "Requiem"),
    (3500,  "Concerto"),
    (2500,  "Suite"),
    (1800,  "Fugue"),
    (1200,  "Sonata"),
    (800,   "Prelude"),
    (500,   "Chorale"),
    (300,   "Invention"),
    (150,   "Canon"),
    (75,    "Period"),
    (25,    "Phrase"),
    (0,     "Motif")
  )

  def fromPoints(points: Int): String =
    Ladder.find(_._1 <= points).map(_._2).getOrElse("Motif")

  def nextThreshold(points: Int): Option[(Int, String)] =
    Ladder.reverse.find(_._1 > points)

  def difficultyPoints(difficulty: String): Int = difficulty match
    case "beginner"     => 10
    case "intermediate" => 15
    case "advanced"     => 25
    case "expert"       => 40
    case _              => 10

  def inferDifficulty(completionRate: BigDecimal, attemptCount: Int): String =
    if attemptCount < 5 then "intermediate"
    else if completionRate >= 0.80 then "beginner"
    else if completionRate >= 0.50 then "intermediate"
    else if completionRate >= 0.25 then "advanced"
    else "expert"

package contrapunctus.backend

import cats.effect.{IO, Resource}
import cats.syntax.semigroupk._
import com.dimafeng.testcontainers.PostgreSQLContainer
import io.circe.Json
import io.circe.syntax._
import org.http4s._
import org.http4s.circe.CirceEntityCodec._
import org.http4s.headers.Authorization
import org.http4s.implicits._
import org.http4s.server.Router
import skunk.Session
import contrapunctus.backend.routes._
import contrapunctus.backend.services._

object TestApp:

  val jwtSecret     = "test-secret-key-for-tests"
  val adminPassword = "test-admin-password"

  def withApp(c: PostgreSQLContainer)(f: HttpApp[IO] => IO[Unit]): IO[Unit] =
    TestDatabase.migrate(c) *>
      TestDatabase.sessionPool(c).use { pool =>
        f(buildApp(pool))
      }

  def buildApp(pool: Resource[IO, Session[IO]]): HttpApp[IO] =
    val emailService          = EmailService.noOp
    val userService           = UserService.make(pool, jwtSecret, emailService)
    val bugReportService      = BugReportService.make(pool)
    val featureRequestService = FeatureRequestService.make(pool)
    val correctionService     = CorrectionService.make(pool)
    val lessonService         = LessonService.make(pool)
    val educatorService       = EducatorService.make(pool)
    val pointsService         = PointsService.make(pool)
    val exerciseService       = ExerciseService.make(pool, pointsService)
    val resetService          = PasswordResetService.make(pool, emailService)
    val projectService        = ProjectService.make(pool)

    val apiRoutes = SignupRoutes.routes(userService)
      <+> LoginRoutes.routes(userService)
      <+> PasswordResetRoutes.routes(resetService)
      <+> BugReportRoutes.routes(bugReportService, jwtSecret)
      <+> FeatureRequestRoutes.routes(featureRequestService, jwtSecret)
      <+> CorrectionRoutes.routes(correctionService, jwtSecret)
      <+> RoadmapRoutes.routes(pool, jwtSecret)
      <+> EducatorRoutes.routes(educatorService, jwtSecret)
      <+> StudentRoutes.routes(educatorService, jwtSecret)
      <+> JoinRoutes.routes(educatorService, jwtSecret)
      <+> LessonRoutes.publicRoutes(lessonService)
      <+> LessonRoutes.adminRoutes(lessonService, adminPassword)
      <+> CommunityRoutes.routes(exerciseService, pointsService, jwtSecret)
      <+> ProjectRoutes.routes(projectService, jwtSecret)
      <+> AdminRoutes.routes(pool, adminPassword)

    Router("/api" -> apiRoutes).orNotFound

  def signup(app: HttpApp[IO], email: String, name: String, isEducator: Boolean = false): IO[(String, Json)] =
    val req = Request[IO](Method.POST, uri"/api/signup")
      .withEntity(Json.obj(
        "email"       -> email.asJson,
        "displayName" -> name.asJson,
        "password"    -> "password123".asJson,
        "isEducator"  -> isEducator.asJson
      ))
    app.run(req).flatMap(_.as[Json]).map { body =>
      (body.hcursor.get[String]("token").toOption.get, body)
    }

  def authHeader(token: String): Authorization =
    Authorization(Credentials.Token(AuthScheme.Bearer, token))

  def adminHeader: Header.Raw =
    Header.Raw(org.typelevel.ci.CIString("X-Admin-Token"), adminPassword)

package contrapunctus.backend

import cats.syntax.semigroupk._
import cats.effect.{IO, Resource}
import com.comcast.ip4s._
import fs2.io.net.Network
import org.http4s.HttpRoutes
import org.http4s.client.Client
import org.http4s.dsl.io._
import org.http4s.implicits._
import org.http4s.server.Router
import org.http4s.server.middleware.{CORS, Logger}
import org.http4s.ember.server.EmberServerBuilder
import org.http4s.ember.client.EmberClientBuilder
import skunk.Session
import contrapunctus.backend.routes.{AdminRoutes, BugReportRoutes, CommunityRoutes, CorrectionRoutes, EducatorRoutes, FeatureRequestRoutes, JoinRoutes, LessonRoutes, LoginRoutes, OAuthRoutes, PasswordResetRoutes, ProfileRoutes, ProjectRoutes, RoadmapRoutes, ShareRoutes, SignupRoutes, StudentRoutes}
import contrapunctus.backend.services.{BugReportService, CorrectionService, EducatorService, EmailService, ExerciseService, FeatureRequestService, LessonService, OAuthService, PasswordResetService, PointsService, ProjectService, ShareService, UserService}

object Server:
  def run(pool: Resource[IO, Session[IO]], config: AppConfig): IO[Nothing] =
    given Network[IO] = Network.forAsync[IO]

    EmberClientBuilder.default[IO].build.use { httpClient =>
      val emailService          = if config.fromEmail.nonEmpty then
                                    EmailService.make(config.frontendBaseUrl, config.sesRegion, config.fromEmail)
                                  else
                                    EmailService.noOp
      val userService           = UserService.make(pool, config.jwtSecret, emailService)
      val bugReportService      = BugReportService.make(pool)
      val featureRequestService = FeatureRequestService.make(pool)
      val correctionService     = CorrectionService.make(pool)
      val lessonService         = LessonService.make(pool)
      val educatorService       = EducatorService.make(pool)
      val pointsService         = PointsService.make(pool)
      val exerciseService       = ExerciseService.make(pool, pointsService)
      val resetService          = PasswordResetService.make(pool, emailService)
      val projectService        = ProjectService.make(pool)
      val shareService          = ShareService.make(pool, config.sharesBucket, config.sharesRegion, projectService)
      val oAuthService          = OAuthService.make(pool, httpClient, config.jwtSecret, config.googleClientId, emailService)

      val healthRoutes = HttpRoutes.of[IO] { case GET -> Root / "health" => Ok("ok") }
      val apiRoutes    = SignupRoutes.routes(userService)
                     <+> LoginRoutes.routes(userService)
                     <+> PasswordResetRoutes.routes(resetService)
                     <+> OAuthRoutes.routes(oAuthService)
                     <+> BugReportRoutes.routes(bugReportService, config.jwtSecret)
                     <+> FeatureRequestRoutes.routes(featureRequestService, config.jwtSecret)
                     <+> CorrectionRoutes.routes(correctionService, config.jwtSecret)
                     <+> RoadmapRoutes.routes(pool, config.jwtSecret)
                     <+> EducatorRoutes.routes(educatorService, config.jwtSecret)
                     <+> StudentRoutes.routes(educatorService, config.jwtSecret)
                     <+> JoinRoutes.routes(educatorService, config.jwtSecret)
                     <+> LessonRoutes.publicRoutes(lessonService)
                     <+> LessonRoutes.adminRoutes(lessonService, config.adminPassword)
                     <+> CommunityRoutes.routes(exerciseService, pointsService, config.jwtSecret)
                     <+> ProjectRoutes.publicRoutes(projectService)
                     <+> ProjectRoutes.routes(projectService, config.jwtSecret)
                     <+> ShareRoutes.apiRoutes(shareService, config.backendBaseUrl, config.jwtSecret)
                     <+> ProfileRoutes.routes(pool, config.jwtSecret)
                     <+> AdminRoutes.routes(pool, config.adminPassword)

      val sharePublicRoutes = ShareRoutes.publicRoutes(shareService, config.backendBaseUrl, config.frontendBaseUrl)
      val loggedApiRoutes   = Logger.httpRoutes(logHeaders = false, logBody = false)(apiRoutes)
      val routes            = Router("/" -> (healthRoutes <+> sharePublicRoutes), "/api" -> loggedApiRoutes)
      val corsRoutes        = CORS.policy.withAllowOriginAll(routes.orNotFound)

      EmberServerBuilder
        .default[IO]
        .withHost(ipv4"0.0.0.0")
        .withPort(port"8080")
        .withHttpApp(corsRoutes)
        .build
        .useForever
    }

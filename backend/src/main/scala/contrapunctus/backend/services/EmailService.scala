package contrapunctus.backend.services

import cats.effect.IO
import software.amazon.awssdk.services.ses.SesClient
import software.amazon.awssdk.services.ses.model._
import software.amazon.awssdk.regions.Region

trait EmailService:
  def sendPasswordReset(toEmail: String, resetToken: String): IO[Unit]

object EmailService:
  def make(frontendBaseUrl: String, sesRegion: String, fromEmail: String): EmailService =
    new EmailService:
      private val client = SesClient.builder()
        .region(Region.of(sesRegion))
        .build()

      def sendPasswordReset(toEmail: String, resetToken: String): IO[Unit] =
        IO.blocking {
          val resetUrl = s"$frontendBaseUrl/reset-password?token=$resetToken"
          val html =
            s"""<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
               |  <h2 style="font-size: 20px; font-weight: 700; color: #1a1a1a;">Reset your password</h2>
               |  <p style="font-size: 14px; color: #555; line-height: 1.6;">
               |    Click the link below to reset your Contrapunctus password. This link expires in 1 hour.
               |  </p>
               |  <a href="$resetUrl" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
               |    Reset Password
               |  </a>
               |  <p style="font-size: 12px; color: #999; line-height: 1.5;">
               |    If you didn't request this, you can ignore this email.
               |  </p>
               |</div>""".stripMargin

          val request = SendEmailRequest.builder()
            .source(fromEmail)
            .destination(Destination.builder().toAddresses(toEmail).build())
            .message(
              Message.builder()
                .subject(Content.builder().data("Reset your Contrapunctus password").charset("UTF-8").build())
                .body(Body.builder()
                  .html(Content.builder().data(html).charset("UTF-8").build())
                  .build())
                .build()
            )
            .build()

          client.sendEmail(request)
          ()
        }

  def noOp: EmailService =
    new EmailService:
      def sendPasswordReset(toEmail: String, resetToken: String): IO[Unit] =
        IO.println(s"[EmailService.noOp] Reset token for $toEmail: $resetToken")

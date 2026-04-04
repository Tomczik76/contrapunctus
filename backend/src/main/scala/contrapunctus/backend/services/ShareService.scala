package contrapunctus.backend.services

import cats.effect.{IO, Resource}
import skunk.Session
import contrapunctus.backend.db.ShareImages
import contrapunctus.backend.domain.ShareImage
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import software.amazon.awssdk.regions.Region

import java.util.UUID

trait ShareService:
  def create(userId: UUID, sourceType: String, sourceId: UUID,
             title: String, description: String, imageData: Array[Byte]): IO[ShareImage]
  def get(id: UUID): IO[Option[ShareImage]]
  def getBySource(sourceType: String, sourceId: UUID): IO[Option[ShareImage]]

object ShareService:
  def make(pool: Resource[IO, Session[IO]], bucket: String, s3Region: String, projectService: ProjectService): ShareService =
    new ShareService:
      private lazy val s3 = S3Client.builder()
        .region(Region.of(s3Region))
        .build()

      def create(userId: UUID, sourceType: String, sourceId: UUID,
                 title: String, description: String, imageData: Array[Byte]): IO[ShareImage] =
        for
          imageId <- IO(UUID.randomUUID())
          key     = s"shares/$imageId.png"
          _       <- IO.blocking {
            s3.putObject(
              PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType("image/png")
                .cacheControl("public, max-age=31536000")
                .build(),
              RequestBody.fromBytes(imageData)
            )
          }
          imageUrl = s"https://$bucket.s3.$s3Region.amazonaws.com/$key"
          share   <- pool.use(_.unique(ShareImages.insert)(
            (userId, sourceType, sourceId, title, description, imageUrl)
          ))
          _ <- if sourceType == "project" then projectService.markShared(sourceId, userId).void else IO.unit
        yield share

      def get(id: UUID): IO[Option[ShareImage]] =
        pool.use(_.option(ShareImages.selectById)(id))

      def getBySource(sourceType: String, sourceId: UUID): IO[Option[ShareImage]] =
        pool.use(_.option(ShareImages.selectLatestBySource)((sourceType, sourceId)))

  /** Test-only: stores a fake URL instead of uploading to S3. */
  def makeTest(pool: Resource[IO, Session[IO]], projectService: ProjectService): ShareService =
    new ShareService:
      def create(userId: UUID, sourceType: String, sourceId: UUID,
                 title: String, description: String, imageData: Array[Byte]): IO[ShareImage] =
        val imageUrl = s"https://test-bucket.s3.us-west-2.amazonaws.com/shares/${UUID.randomUUID()}.png"
        for
          share <- pool.use(_.unique(ShareImages.insert)(
            (userId, sourceType, sourceId, title, description, imageUrl)
          ))
          _ <- if sourceType == "project" then projectService.markShared(sourceId, userId).void else IO.unit
        yield share

      def get(id: UUID): IO[Option[ShareImage]] =
        pool.use(_.option(ShareImages.selectById)(id))

      def getBySource(sourceType: String, sourceId: UUID): IO[Option[ShareImage]] =
        pool.use(_.option(ShareImages.selectLatestBySource)((sourceType, sourceId)))

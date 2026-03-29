package contrapunctus.crawler

import cats.effect.{IO, Ref, Resource}
import cats.syntax.all.*
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient
import software.amazon.awssdk.services.bedrockruntime.model.*
import software.amazon.awssdk.regions.Region
import scala.jdk.CollectionConverters.*

/** Wrapper around AWS Bedrock Converse API with cost tracking. */
class LlmClient private (
    modelId: String,
    client: BedrockRuntimeClient,
    inputPricePerM: Double,
    outputPricePerM: Double,
    totalInputTokens: Ref[IO, Long],
    totalOutputTokens: Ref[IO, Long],
    requestCount: Ref[IO, Int]
):

  def ask(prompt: String, maxTokens: Int = 1024): IO[String] =
    IO.blocking {
      val message = Message.builder()
        .role(ConversationRole.USER)
        .content(ContentBlock.fromText(prompt))
        .build()

      val config = InferenceConfiguration.builder()
        .maxTokens(maxTokens)
        .temperature(0.0f)
        .build()

      val request = ConverseRequest.builder()
        .modelId(modelId)
        .messages(message)
        .inferenceConfig(config)
        .build()

      val response = client.converse(request)
      (response.output().message().content().asScala.map(_.text()).mkString(""), response.usage())
    }.flatMap { case (text, usage) =>
      totalInputTokens.update(_ + usage.inputTokens().toLong) *>
        totalOutputTokens.update(_ + usage.outputTokens().toLong) *>
        requestCount.update(_ + 1) *>
        IO.pure(text)
    }

  def costSoFar: IO[Double] =
    (totalInputTokens.get, totalOutputTokens.get).mapN { (input, output) =>
      (input * inputPricePerM + output * outputPricePerM) / 1_000_000.0
    }

  def close(): Unit = client.close()

  def costString: IO[String] =
    (totalInputTokens.get, totalOutputTokens.get, requestCount.get, costSoFar).mapN {
      (input, output, count, cost) =>
        f"$$$cost%.4f ($count calls, $input+$output tokens)"
    }

object LlmClient:

  // Pricing per million tokens
  private def inputPrice(modelId: String): Double = modelId match
    case m if m.contains("haiku")      => 0.80
    case m if m.contains("sonnet")     => 3.00
    case m if m.contains("nova-lite")  => 0.06
    case m if m.contains("nova-micro") => 0.035
    case m if m.contains("nova-pro")   => 0.80
    case _                             => 1.00

  private def outputPrice(modelId: String): Double = modelId match
    case m if m.contains("haiku")      => 4.00
    case m if m.contains("sonnet")     => 15.00
    case m if m.contains("nova-lite")  => 0.24
    case m if m.contains("nova-micro") => 0.14
    case m if m.contains("nova-pro")   => 3.20
    case _                             => 5.00

  def resource(
      modelId: String = "us.anthropic.claude-3-5-haiku-20241022-v1:0",
      region: Region = Region.US_EAST_1
  ): Resource[IO, LlmClient] =
    Resource.make(
      for
        inputRef  <- Ref.of[IO, Long](0L)
        outputRef <- Ref.of[IO, Long](0L)
        countRef  <- Ref.of[IO, Int](0)
        client    <- IO(BedrockRuntimeClient.builder().region(region).build())
      yield new LlmClient(modelId, client, inputPrice(modelId), outputPrice(modelId), inputRef, outputRef, countRef)
    )(llm => IO(llm.close()))

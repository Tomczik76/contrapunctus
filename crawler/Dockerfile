# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM --platform=linux/arm64 eclipse-temurin:21-jdk-jammy AS builder

RUN apt-get update && apt-get install -y curl && \
    curl -fL "https://github.com/sbt/sbt/releases/download/v1.10.7/sbt-1.10.7.tgz" \
      | tar xz -C /usr/local && \
    ln -s /usr/local/sbt/bin/sbt /usr/local/bin/sbt

WORKDIR /build

# Cache dependency resolution separately from source compilation
COPY project/ project/
COPY build.sbt .
RUN sbt update

# Compile and assemble fat JAR
COPY crawler/ crawler/
COPY shared/ shared/
RUN sbt crawler/assembly

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM --platform=linux/arm64 eclipse-temurin:21-jre-jammy

WORKDIR /app
COPY --from=builder /build/crawler/target/scala-3.5.2/crawler.jar app.jar
COPY crawler/universities.txt universities.txt

ENTRYPOINT ["java", "-Xmx512m", "-jar", "app.jar"]

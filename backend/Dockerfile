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
RUN SBT_OPTS="-Xmx1g -Xss4m" sbt update

# Copy shared (core) module sources — backend depends on core.jvm
COPY shared/ shared/

# Compile and assemble fat JAR
COPY backend/ backend/
RUN SBT_OPTS="-Xmx1g -Xss4m" sbt backend/assembly

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM --platform=linux/arm64 eclipse-temurin:21-jre-alpine

RUN apk add --no-cache curl

WORKDIR /app
COPY --from=builder /build/backend/target/scala-3.5.2/backend.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-Xmx512m", "-jar", "app.jar"]

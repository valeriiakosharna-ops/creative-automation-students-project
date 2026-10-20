# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS frontend
WORKDIR /build/studio
COPY studio/package.json studio/package-lock.json ./
# Optional secrets support the managed environment's proxy/CA without baking it in.
RUN --mount=type=cache,target=/root/.npm --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --strict-ssl=true
COPY index.html styles.css script.js /build/
COPY assets /build/assets
COPY style-guide /build/style-guide
COPY studio/ ./
RUN npm test && npm run build

FROM maven:3.9.11-eclipse-temurin-21 AS server
WORKDIR /build/server
COPY studio/server/pom.xml ./
COPY studio/server/src ./src
COPY studio/brand-policy.json /build/brand-policy.json
COPY --from=frontend /build/studio/dist /build/dist
RUN --mount=type=cache,target=/root/.m2 \
    --mount=type=secret,id=maven_settings --mount=type=secret,id=maven_truststore \
    set -eu; set --; \
    if [ -f /run/secrets/maven_settings ]; then set -- "$@" -s /run/secrets/maven_settings; fi; \
    if [ -f /run/secrets/maven_truststore ]; then export MAVEN_OPTS="${MAVEN_OPTS:-} -Djavax.net.ssl.trustStore=/run/secrets/maven_truststore"; fi; \
    mvn --batch-mode --no-transfer-progress "$@" verify

FROM eclipse-temurin:21-jre-jammy AS runtime
WORKDIR /app
COPY --from=server --chmod=0444 /build/server/target/studio-server-0.1.0.jar /app/studio.jar
ENV SPRING_PROFILES_ACTIVE=hosted \
    STUDIO_BIND_ADDRESS=0.0.0.0 \
    PORT=8080 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0"
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/studio.jar"]

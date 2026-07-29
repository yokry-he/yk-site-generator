FROM maven:3.9-eclipse-temurin-21-alpine
RUN addgroup -g 10001 runner && adduser -D -u 10001 -G runner runner
ENV CI=true HOME=/tmp MAVEN_OPTS=-Dmaven.repo.local=/tmp/m2
WORKDIR /workspace
USER 10001:10001

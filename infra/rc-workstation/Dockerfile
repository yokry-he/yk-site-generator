ARG NODE_IMAGE=node:24-bookworm
ARG GO_IMAGE=golang:1.25-bookworm
ARG MAVEN_IMAGE=maven:3.9-eclipse-temurin-21
ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.8.15
ARG RUNTIME_IMAGE=mcr.microsoft.com/playwright:v1.61.1-noble

FROM ${NODE_IMAGE} AS node_toolchain
FROM ${GO_IMAGE} AS go_toolchain
FROM ${MAVEN_IMAGE} AS java_toolchain
FROM ${UV_IMAGE} AS uv_toolchain
FROM ${RUNTIME_IMAGE}

ARG PNPM_VERSION=11.0.0
ARG PYTHON_VERSION=3.14
ARG USER_UID=10001
ARG USER_GID=10001

ENV DEBIAN_FRONTEND=noninteractive \
    JAVA_HOME=/opt/java/openjdk \
    MAVEN_HOME=/usr/share/maven \
    GOROOT=/usr/local/go \
    GOPATH=/home/siteforge/go \
    UV_PYTHON_INSTALL_DIR=/opt/uv-python \
    PNPM_HOME=/home/siteforge/.local/share/pnpm \
    PNPM_STORE_DIR=/home/siteforge/.local/share/pnpm/store \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PATH=/home/siteforge/.local/share/pnpm:/usr/share/maven/bin:/usr/local/go/bin:/opt/java/openjdk/bin:/usr/local/bin:/usr/bin:/bin

COPY --from=node_toolchain /usr/local/bin/node /usr/local/bin/node
COPY --from=node_toolchain /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=go_toolchain /usr/local/go /usr/local/go
COPY --from=java_toolchain /opt/java/openjdk /opt/java/openjdk
COPY --from=java_toolchain /usr/share/maven /usr/share/maven
COPY --from=uv_toolchain /uv /usr/local/bin/uv

RUN set -eux; \
    ln -sf /usr/local/lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack; \
    ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm; \
    ln -sf /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx; \
    corepack enable; \
    corepack prepare "pnpm@${PNPM_VERSION}" --activate; \
    uv python install "${PYTHON_VERSION}"; \
    ln -sf "$(uv python find "${PYTHON_VERSION}")" /usr/local/bin/python3; \
    ln -sf /usr/local/bin/python3 /usr/local/bin/python; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ca-certificates curl git jq unzip \
      postgresql-client default-mysql-client redis-tools; \
    rm -rf /var/lib/apt/lists/*; \
    groupadd --gid "${USER_GID}" siteforge; \
    useradd --uid "${USER_UID}" --gid "${USER_GID}" --create-home --shell /bin/bash siteforge; \
    mkdir -p /workspace /home/siteforge/.cache/uv /home/siteforge/.cache/ms-playwright \
      /home/siteforge/.local/share/pnpm/store /home/siteforge/.m2 /home/siteforge/go; \
    chown -R siteforge:siteforge /workspace /home/siteforge /opt/uv-python /ms-playwright

USER siteforge:siteforge
WORKDIR /workspace
CMD ["sleep", "infinity"]

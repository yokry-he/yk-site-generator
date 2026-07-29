FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@11 --activate && addgroup -g 10001 runner && adduser -D -u 10001 -G runner runner
ENV CI=true HOME=/tmp PNPM_HOME=/tmp/pnpm
WORKDIR /workspace
USER 10001:10001

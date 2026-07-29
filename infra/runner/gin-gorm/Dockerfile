FROM golang:1.25-alpine
RUN addgroup -g 10001 runner && adduser -D -u 10001 -G runner runner
ENV CI=true HOME=/tmp GOCACHE=/tmp/go-build GOMODCACHE=/tmp/go-mod
WORKDIR /workspace
USER 10001:10001

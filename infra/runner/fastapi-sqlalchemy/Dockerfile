FROM python:3.14-slim
RUN pip install --no-cache-dir uv pytest && groupadd -g 10001 runner && useradd -m -u 10001 -g 10001 runner
ENV CI=true HOME=/tmp UV_CACHE_DIR=/tmp/uv-cache
WORKDIR /workspace
USER 10001:10001

#!/bin/bash
# Update the Transfermarkt spider app to a given GHCR image tag.
#
# No docker-compose: the app runs as a standalone `docker run` container (like
# the backend). This script only touches the `tm_app` container — it pulls the
# new image, then recreates the container. rustfs (tm_rustfs) and the shared
# Postgres (sports-calendar-postgres) are NEVER touched by an update; they are
# started once (see start-rustfs.sh) and left running.
#
# Mirrors update-sports-calendar.sh: pull FIRST, only swap the container once the
# pull succeeds.
#
# Usage:  update-sports-spider.sh v1.0.0-sp
set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "错误: 请提供版本号。用法: $0 v1.0.0-sp"
    exit 1
fi

TARGET_VERSION="$1"
NAME="tm_app"
ENV_FILE="/opt/sports-spider/.env"
IMAGE_BASE="ghcr.io/vamosdalian/sports-spider"
FULL_IMAGE="${IMAGE_BASE}:${TARGET_VERSION}"

echo "--- 目标 spider 版本: ${TARGET_VERSION} ---"

# 1. 版本相同则跳过
CURRENT=$(docker inspect --format='{{.Config.Image}}' "${NAME}" 2>/dev/null || true)
if [ "${CURRENT}" == "${FULL_IMAGE}" ]; then
    echo "当前已是 ${TARGET_VERSION}，无需更新。跳过。"
    exit 0
fi

# 2. 先拉镜像,确保可用后再动旧容器
echo "正在拉取镜像: ${FULL_IMAGE} ..."
if ! docker pull "${FULL_IMAGE}"; then
    echo "错误: 镜像拉取失败！保持原状，退出。"
    exit 1
fi

# 3. 移除旧 app 容器(不碰 rustfs / postgres)
docker rm -f "${NAME}" >/dev/null 2>&1 || true

# 4. 用新镜像起 app。DATABASE_URL / SCRAPER_PROXY / 密钥来自 .env;
#    S3 端点与打码 provider 在此覆盖为容器内值。
docker run -d \
  --name "${NAME}" \
  --restart unless-stopped \
  --network sports-calendar-net \
  --env-file "${ENV_FILE}" \
  -e S3_ENDPOINT_URL=http://rustfs:9000 \
  -e CAPTCHA_PROVIDER=2captcha \
  -e API_HOST=0.0.0.0 \
  -e API_PORT=8000 \
  -p 127.0.0.1:8001:8000 \
  -v sports-spider_browser_profile:/app/.browser_profile \
  "${FULL_IMAGE}"

echo "成功: ${NAME} 已更新至 ${TARGET_VERSION}。"

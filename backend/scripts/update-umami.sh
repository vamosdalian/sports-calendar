#!/bin/bash
# Update the self-hosted Umami analytics container to a newer image.
#
# Mirrors update-sports-calendar.sh: pull first, and only tear down the running
# container once the new image is actually on disk, so a failed pull leaves the
# current instance serving. Analytics data lives in the `umami` Postgres
# database and is untouched by this script; Umami migrates its own schema on
# boot.
set -euo pipefail

NAME="umami"
TAG="${1:-postgresql-latest}"
IMAGE="ghcr.io/umami-software/umami:${TAG}"
ENV_FILE="/opt/umami/.env"

if [ ! -f "${ENV_FILE}" ]; then
    echo "缺少 ${ENV_FILE}。先跑 start-umami.sh。" >&2
    exit 1
fi

CURRENT=$(docker inspect --format '{{.Config.Image}}' "${NAME}" 2>/dev/null || echo "")
if [ "${CURRENT}" = "${IMAGE}" ] && [ "${TAG}" != "postgresql-latest" ]; then
    echo "${NAME} 已是 ${IMAGE},跳过。"
    exit 0
fi

echo "拉取 ${IMAGE} ..."
docker pull "${IMAGE}"

echo "重建容器 ..."
docker rm -f "${NAME}" >/dev/null 2>&1 || true

docker run -d \
  --name "${NAME}" \
  --restart unless-stopped \
  --network sports-calendar-net \
  --env-file "${ENV_FILE}" \
  -p 127.0.0.1:13000:3000 \
  "${IMAGE}"

echo "成功: ${NAME} 已更新为 ${IMAGE}。"

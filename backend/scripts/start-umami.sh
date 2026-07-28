#!/bin/bash
# One-time start of the self-hosted Umami analytics instance.
#
# Umami is cookie-free, so the public site needs no consent banner — which
# matters because a banner would sit right on top of the subscribe conversion
# we are trying to measure.
#
# No docker-compose: like every other service here it is a standalone container
# on the shared sports-calendar-net. It reuses the main Postgres instance
# (separate `umami` database) rather than running its own, and applies its own
# schema migrations on first boot.
#
# Published on 127.0.0.1:13000 only — never on a public interface. The
# cloudflared systemd tunnel maps analytics.sports-calendar.com to that port.
#
# Config lives in /opt/umami/.env (DATABASE_URL, APP_SECRET), chmod 600, and is
# never committed. Run this ONCE; updates go through update-umami.sh.
set -euo pipefail

NAME="umami"
IMAGE="ghcr.io/umami-software/umami:postgresql-latest"
ENV_FILE="/opt/umami/.env"

if [ ! -f "${ENV_FILE}" ]; then
    echo "缺少 ${ENV_FILE}(需含 DATABASE_URL 与 APP_SECRET)。" >&2
    exit 1
fi

if docker inspect "${NAME}" >/dev/null 2>&1; then
    echo "${NAME} 已存在。如需重建先 docker rm -f ${NAME}(数据在 Postgres 里,不会丢)。"
    exit 0
fi

docker pull "${IMAGE}"

docker run -d \
  --name "${NAME}" \
  --restart unless-stopped \
  --network sports-calendar-net \
  --env-file "${ENV_FILE}" \
  -p 127.0.0.1:13000:3000 \
  "${IMAGE}"

echo "成功: ${NAME} 已启动(127.0.0.1:13000,网络 sports-calendar-net,库 umami)。"
echo "首次启动会自动建表,约需 10-30 秒。默认账号 admin / umami —— 请立刻改密码。"

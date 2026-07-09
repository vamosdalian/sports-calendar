#!/bin/bash
# One-time start of the rustfs object store (S3-compatible) used by the spider
# to keep a raw-HTML snapshot of every fetched page.
#
# No docker-compose: rustfs is a long-lived standalone container on the shared
# sports-calendar-net, so the app reaches it by container name (tm_rustfs). Run
# this ONCE; spider updates (update-sports-spider.sh) never touch it. Data lives
# in the named volume sports-spider_rustfs_data and survives restarts.
set -euo pipefail

NAME="tm_rustfs"

if docker inspect "${NAME}" >/dev/null 2>&1; then
    echo "${NAME} 已存在。如需重建先 docker rm -f ${NAME}(数据在卷里,不会丢)。"
    exit 0
fi

docker run -d \
  --name "${NAME}" \
  --restart unless-stopped \
  --network sports-calendar-net \
  -e RUSTFS_ACCESS_KEY=rustfsadmin \
  -e RUSTFS_SECRET_KEY=rustfsadmin \
  -e RUSTFS_CONSOLE_ENABLE=true \
  -v sports-spider_rustfs_data:/data \
  rustfs/rustfs:latest /data

echo "成功: ${NAME} 已启动(网络 sports-calendar-net,卷 sports-spider_rustfs_data)。"

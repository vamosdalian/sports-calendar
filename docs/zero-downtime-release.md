# sports-calendar 零停机发布顺序

本文给出当前仓库可直接落地的零停机发布流程，目标是：

1. 用户访问 `sports-calendar.com`、`api.sports-calendar.com` 不中断
2. 发布失败可在 1 分钟内回滚
3. 发布过程可观测、可验证

---

## 1. 适用前提

要做到真正零停机，必须满足：

1. API 前面有稳定入口（推荐本机 Nginx），入口端口不变
2. 新旧 API 容器并行运行（蓝绿发布）
3. 通过切换 upstream 实现流量切换，而不是直接停老容器

说明：

1. 如果你直接 `docker rm -f sports-calendar-api` 再启动新容器，会有短暂中断，不是零停机。
2. 若使用 Cloudflare Tunnel，也建议 Tunnel 指向本机 Nginx，再由 Nginx切到蓝/绿容器。

---

## 2. 命名约定（建议固定）

1. 蓝版本容器：`sports-calendar-api-blue`
2. 绿版本容器：`sports-calendar-api-green`
3. 稳定入口：Nginx 监听 `127.0.0.1:8080`
4. 蓝版本监听：`127.0.0.1:18080`
5. 绿版本监听：`127.0.0.1:18081`

---

## 3. 一次发布的标准顺序

## 3.1 发布前确认

在发布机（CI 或本地）执行：

```bash
cd backend && go test ./...
cd ../web && npm run build
cd ../admin && npm run build
```

并准备新镜像 tag，例如：`release-2026-04-10-01`。

## 3.2 推送新镜像

```bash
docker build -f backend/Dockerfile -t your-registry/sports-calendar-api:release-2026-04-10-01 .
docker push your-registry/sports-calendar-api:release-2026-04-10-01
```

## 3.3 识别当前在线颜色

```bash
docker ps --format '{{.Names}} {{.Ports}}' | grep sports-calendar-api
```

示例判断：

1. 若 `sports-calendar-api-blue` 在跑，则本次发布目标是 `green`
2. 若 `sports-calendar-api-green` 在跑，则本次发布目标是 `blue`

## 3.4 启动“新颜色”容器（不切流）

假设当前在线是 blue，本次发布 green：

```bash
docker rm -f sports-calendar-api-green 2>/dev/null || true

docker run -d \
  --name sports-calendar-api-green \
  --restart unless-stopped \
  --network sports-calendar-net \
  -p 127.0.0.1:18081:8080 \
  -v /opt/sports-calendar/config/config.prod.yaml:/app/config.yaml:ro \
  your-registry/sports-calendar-api:release-2026-04-10-01 \
  -config /app/config.yaml
```

## 3.5 对新颜色做健康检查

```bash
curl -i http://127.0.0.1:18081/healthz
curl -s http://127.0.0.1:18081/api/leagues?lang=en | jq .
curl -I http://127.0.0.1:18081/ics/football/csl/2026/matches.ics
```

要求：全部成功后再切流。

## 3.6 切换 Nginx upstream 到新颜色

Nginx 示例（`/etc/nginx/conf.d/api-upstream.conf`）：

```nginx
upstream sports_calendar_api {
    server 127.0.0.1:18081;  # 发布时切换到新颜色
    keepalive 64;
}

server {
    listen 127.0.0.1:8080;
    server_name _;

    location / {
        proxy_pass http://sports_calendar_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

切流命令：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

`reload` 不会中断现有连接，可实现零停机切换。

## 3.7 切流后再做线上验证

```bash
curl -i https://api.sports-calendar.com/healthz
curl -s https://api.sports-calendar.com/api/leagues?lang=en | jq .
curl -I https://api.sports-calendar.com/ics/football/csl/2026/matches.ics
```

再做 Web 验证：

1. 首页打开正常
2. 赛季页打开正常
3. Subscribe 链接可订阅

## 3.8 观察窗口

建议观察 10-30 分钟：

1. 5xx 是否上升
2. API p95/p99 延迟是否异常
3. 错误日志是否持续增长

确认稳定后，可停止旧颜色容器：

```bash
docker rm -f sports-calendar-api-blue
```

---

## 4. Cloudflare Tunnel 场景下的零停机

若你使用 Tunnel，推荐流量路径：

1. Cloudflare Tunnel -> `http://127.0.0.1:8080`（本机 Nginx）
2. Nginx -> blue/green 容器

好处：

1. Tunnel 配置不需要每次改
2. 切流仍走 Nginx reload，无连接中断

不推荐每次发布都改 Tunnel ingress 指向不同端口，因为会增加配置变更风险与切换复杂度。

---

## 5. 回滚顺序（1分钟内）

如果切流后发现异常：

1. 立即把 Nginx upstream 改回旧颜色端口
2. `nginx -t && systemctl reload nginx`
3. 再排查新颜色容器日志

示例：green 有问题，回滚到 blue：

```bash
# 修改 upstream 到 127.0.0.1:18080
sudo nginx -t && sudo systemctl reload nginx

curl -i https://api.sports-calendar.com/healthz
```

可选：

```bash
docker logs --tail=200 sports-calendar-api-green
```

---

## 6. 前端零停机建议

## 6.1 Web（Cloudflare Workers）

1. 先完成构建并产出新版本
2. 用平台发布新版本
3. 平台完成原子切换后再验收

通常不需要人工做蓝绿，平台本身会提供近似零停机切换。

## 6.2 Admin（Cloudflare Pages 或静态托管）

1. 构建 `admin/dist`
2. 发布新版本
3. 验证登录与核心页面

---

## 7. 可复制的发布清单（简版）

1. 推新镜像 tag
2. 起新颜色容器（不同端口）
3. 本机健康检查通过
4. Nginx reload 切流
5. 线上健康检查 + 页面验收
6. 观察 10-30 分钟
7. 下线旧颜色

---

## 8. 常见误区

1. 直接停老容器再起新容器：会有中断
2. 新容器未健康就切流：风险高
3. 切流后不观察：问题会延迟暴露
4. Tunnel 直连容器端口且每次改 ingress：不稳定且不易回滚

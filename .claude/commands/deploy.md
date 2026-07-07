---
description: 发布 sports-calendar（前端 CF Workers / 后端服务器 / 全部），完成后给验收清单
argument-hint: web | backend <tag> | all <tag>
---

你要按下面的流程为用户发布 sports-calendar。用户负责最终人工验收，你负责把发布跑完并给出验收清单。

参数：`$ARGUMENTS`
- `web`：只发前端
- `backend <tag>`：只发后端到指定版本，例如 `backend v1.0.12`
- `all <tag>`：先发后端再发前端

## 通用前置
- CF 凭证文件：`~/.sports-calender-deploy.env`（含 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID，注意文件名 calen**der** 拼写）
- 服务器 SSH 别名：`sports-calendar`（= root@39.102.211.97）
- GitHub：本机 `gh` 已登录，含 repo+workflow 权限
- 开始前先 `git -C <repo> status` 确认工作区状态；有未提交改动要先跟用户确认。

## 前端发布（web）
```bash
set -a; . ~/.sports-calender-deploy.env; set +a
cd web && npm run deploy
```
- 从 wrangler 输出里抓取部署后的 URL / version id。
- 失败就停下报错，不要重试掩盖。

## 后端发布（backend <tag>）
⚠️ **最关键：镜像由 GitHub Action 构建推送到 GHCR，必须等 Action 成功后才能在服务器跑 update，否则 `docker pull <tag>` 会因镜像不存在而失败。**

1. 确认代码已推送：`git push origin HEAD`（当前分支）。
2. 确认目标 tag 的镜像是否已就绪：
   - 若该 tag 尚无 GitHub Release，则创建并发布 Release 触发构建：
     `gh release create <tag> --generate-notes`
   - 若 tag/Release 已存在但想重建，可 `gh workflow run backend-release.yml -f tag=<tag>`。
3. **阻塞等待 Action 完成**（不要跳过这步）：
   - 找到本次运行：`gh run list --workflow=backend-release.yml -L 5`
   - 盯到成功：`gh run watch <run-id> --exit-status`（失败则中止并把日志给用户）
4. Action 成功后，在服务器执行现成更新脚本（脚本会先 pull 成功再换容器、同版本自动跳过）：
   `ssh sports-calendar '/root/script/update-sports-calendar.sh <tag>'`
5. 验证后端起来了：
   `ssh sports-calendar 'docker ps --filter name=sports-calendar-api --format "{{.Image}} {{.Status}}"'`
   再探活：`ssh sports-calendar 'curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5959/health || true'`（若无 /health 换个已知路由）。

## 全部（all <tag>）
先跑后端流程（构建耗时长，先起头），成功后再跑前端流程。

## 完成后必须输出「验收清单」给用户
用中文列出，包含：
- 本次发布了什么（前端 version / 后端 tag）
- 线上待验收 URL：前端 https://sports-calendar.com，后端经 api.sports-calendar.com（服务器本地 5959）
- 建议人工检查点（页面能打开、关键数据正确、ICS 订阅可用等）
- 如需回滚：后端 `ssh sports-calendar '/root/script/update-sports-calendar.sh <上一个 tag>'`；前端在 CF 后台回滚到上一个 version。

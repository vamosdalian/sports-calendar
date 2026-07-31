---
description: 发布 sports-calendar（web 走 GitHub Actions / admin 走 CF 自动构建 / 后端服务器 / 全部），完成后给验收清单
argument-hint: web | admin | backend <tag> | all <tag>
---

你要按下面的流程为用户发布 sports-calendar。用户负责最终人工验收，你负责把发布跑完并给出验收清单。

参数：`$ARGUMENTS`
- `web`：只发公开站前端（Worker `sports-calendar-web`）
- `admin`：只发管理后台前端（Worker `sports-calendar-admin`）
- `backend <tag>`：只发后端到指定版本，例如 `backend v1.0.12`
- `all <tag>`：先发后端再发前端（前端默认发 web，需要 admin 时另外说明）

## 通用前置
- CF 凭证文件：`~/.sports-calender-deploy.env`（含 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID，注意文件名 calen**der** 拼写）
- 服务器 SSH 别名：`sports-calendar`（= root@39.102.211.97）
- GitHub：本机 `gh` 已登录，含 repo+workflow 权限
- 开始前先 `git -C <repo> status` 确认工作区状态；有未提交改动要先跟用户确认。

## 前端发布——⚠️ web 和 admin 走两条不同的链路

两边都不在本地跑 `wrangler deploy`，但**触发方式和盯的地方不一样**，别搞混：

| | 谁在构建部署 | 盯哪里 |
|---|---|---|
| `web` → `sports-calendar-web` | **GitHub Actions**（`.github/workflows/web-rebuild.yml`，名为 `Deploy Web`） | `gh run watch` |
| `admin` → `sports-calendar-admin` | **CF Git 自动构建** | CF deployments API |

`sports-calendar-web` 的 CF Git 集成已于 2026-07-31 关闭（构建命令藏在 Dashboard 里、仓库看不见也改不了，静默挂过两次）。**不要建议重新打开它，也不要顺手去动 admin 的。**

共同的前两步：
1. 确认改动在独立分支上（不要直接在 master 上改）：需要时 `git switch -c <branch>`，然后 `git push -u origin <branch>`。
2. 开 PR：`gh pr create --fill`（标题/正文不够清楚就补充）。

### web：合并后盯 Actions
3. `gh pr merge <n> --squash --delete-branch`——这一步触发 workflow 的 `push` 触发器。
4. 拿到 run id 并阻塞等待（整个 job 正常约 1 分半）：
   ```bash
   sleep 10
   RUN=$(gh run list --workflow=web-rebuild.yml -L 1 --json databaseId -q '.[0].databaseId')
   gh run watch "$RUN" --exit-status
   ```
   失败就把日志给用户，不要重试掩盖。

**只改了数据库、没有代码改动时不要造假 commit**——直接 `gh workflow run web-rebuild.yml` 手动触发，然后同样 `gh run watch`。（不手动触发也行，每天 02:23 UTC 那趟车会带上，见文档。）

### admin：合并后轮询 CF
3. **合并前先记录基线部署时间**：
   ```bash
   set -a; . ~/.sports-calender-deploy.env; set +a
   W=sports-calendar-admin
   API="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/$W/deployments"
   latest() { curl -sS "$API" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     | python3 -c 'import sys,json;r=json.load(sys.stdin)["result"];d=r["deployments"] if isinstance(r,dict) else r;print((d[0]["id"] if d else "")+" "+(d[0]["created_on"] if d else ""))'; }
   BASE="$(latest)"; echo "baseline: $BASE"
   ```
4. 合并 PR（CI 通过后）：`gh pr merge <n> --squash --delete-branch`。**这一步是自动部署的触发点。** 默认由你来合；若用户表示要亲自合并，就等合并完成再继续。
5. **阻塞轮询 CF 直到出现比基线更新的部署**（约每 15s 一次，最多 ~10 分钟）：
   ```bash
   for i in $(seq 1 40); do
     NOW="$(latest)"
     [ -n "$NOW" ] && [ "$NOW" != "$BASE" ] && { echo "deployed: $NOW"; break; }
     sleep 15
   done
   ```
   ⚠️ **超时不等于"没触发"**：CF 构建失败同样不产生 deployment，两者从 API 上完全无法区分。所以超时就停下如实报告、让用户去 CF 后台看构建日志，**不要断言"自动构建没启用"，更不要谎报成功**。
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
先跑后端流程（构建耗时长，先起头），成功后再跑前端流程（提 PR → 合并 → 按上面 web/admin 各自的方式盯上线）。

## 完成后必须输出「验收清单」给用户
用中文列出，包含：
- 本次发布了什么（web：PR 链接 + Actions run 链接 + deployment id/时间；admin：PR 链接 + deployment id/时间；后端：tag）
- 线上待验收 URL：前端 https://sports-calendar.com，后端经 api.sports-calendar.com（服务器本地 5959）
- 建议人工检查点（页面能打开、关键数据正确、ICS 订阅可用等）
- 如需回滚：后端 `ssh sports-calendar '/root/script/update-sports-calendar.sh <上一个 tag>'`；前端在 CF 后台把对应 Worker 回滚到上一个 deployment（或 revert PR 后再次自动部署）。

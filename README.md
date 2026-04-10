# 体育赛事日历（sports-calendar）

本项目提供体育赛事订阅日历服务，当前内置 **CSL 中超联赛**，并支持扩展到其他联赛。

## 功能范围

1. 提供多联赛 `ics` 订阅文件（当前已配置 CSL）。
2. 每个队伍输出两份日历：
   - 比赛日历
   - 比赛 + 抢票提醒日历
3. 数据目录统一使用：
   - `JSON`：联赛元信息（`data/leagues.json`）
   - `CSV`：赛程数据（`data/*_fixtures.csv`）
4. 使用 `script/generate_ics.py` 从 JSON + CSV 生成并更新 `calendar/`。
5. Backend 发布通过 GitHub Release 触发 GitHub Actions 自动构建并推送到 GHCR；静态日历文件仍可按需手工生成。

## 目录结构

```text
sports-calendar/
├── assets/
│   └── site.css
├── calendar/                     # 生成后的 ICS 文件
├── data/
│   ├── leagues.json              # 联赛元信息（前端 + 脚本共用）
│   └── csl_fixtures.csv          # 赛程数据
├── script/
│   └── generate_ics.py           # 生成 ICS 的脚本
├── .nojekyll
├── index.html                    # GitHub Pages 首页（订阅入口）
├── requirements.txt
└── README.md
```

## 数据说明

### `data/leagues.json`

`leagues` 数组中每个联赛至少包含：
- `id`
- `name`
- `displayName`（前端展示名，可选）
- `season`
- `timezone`
- `filePrefix`
- `source_file`
- `calendar_name_template`
- `calendar_with_ticket_name_template`
- `calendar_description`
- `teams`（每项含 `code` 与 `name`）

可选字段：
- `prodid`
- `match_summary_template`
- `match_description_template`
- `match_category`
- `ticket_summary_template`
- `ticket_description_template`
- `ticket_duration_minutes`
- `ticket_category`
- `ticket_location`

### `data/*_fixtures.csv`

字段：
- `match_id`
- `round`
- `kickoff`
- `home_team`
- `away_team`
- `stadium`
- `city`
- `ticket_open`
- `ticket_url`
- `ticket_channel`（售票方式，如"小程序"）
- `status`

时间字段使用 ISO-8601，例如：`2026-03-06T19:35:00+08:00`。

## 使用方式

1. 安装依赖

```bash
pip install -r requirements.txt
```

2. 生成全部已配置联赛

```bash
python script/generate_ics.py
```

3. 仅生成某个联赛

```bash
python script/generate_ics.py --league csl
```

4. 指定配置文件/输出目录

```bash
python script/generate_ics.py --config data/leagues.json --output-dir calendar
```

## 输出文件命名

每支球队输出两份：
- `calendar/<filePrefix>_<team-code>.ics`
- `calendar/<filePrefix>_<team-code>_with_ticket.ics`

示例：
- `calendar/csl_beijing-guoan.ics`
- `calendar/csl_beijing-guoan_with_ticket.ics`

## 前端联赛选择与直达链接

首页默认不自动选择联赛，需要先点联赛列表。

- 首页：`https://sports-calendar.com/`
- 联赛直达：`https://sports-calendar.com/?league=csl`

## 新增其他联赛

1. 在 `data/leagues.json` 里新增联赛对象（含球队列表与模板）。
2. 在 `data/` 下新增对应 `source_file` 指向的 CSV。
3. 执行：
   - `python script/generate_ics.py --league <league-id>`
4. 提交 `data/` 与 `calendar/` 更新。

## GitHub Pages（vamosdalian/sports-calendar）

1. 将代码推送到 `vamosdalian/sports-calendar`。
2. 仓库 `Settings` -> `Pages`。
3. 选择 `Deploy from a branch`。
4. 分支选 `main`，目录选 `/ (root)`。
5. 保存并等待发布。

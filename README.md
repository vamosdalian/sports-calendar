# 体育赛事日历（sports-calendar）

本项目提供体育赛事订阅日历服务，第一版仅支持 **CSL 中超联赛**。

## 功能范围

1. 提供 CSL 赛程的 `ics` 订阅文件。
2. 每个队伍提供两份日历：
   - 比赛日历
   - 比赛 + 抢票提醒日历
3. 数据在 `data/`，使用 `csv` 保存赛程，`yaml` 保存联赛元信息。
4. 使用 `script/` 下 Python 脚本（依赖 `icalendar`）从 `data/` 生成并更新 `calendar/` 下 `ics` 文件。
5. 不使用 GitHub Action，采用本地或自建任务调度执行脚本更新。

## 目录结构

```text
sports-calendar/
├── assets/
│   └── site.css             # GitHub Pages 首页样式
├── calendar/                # 生成后的 ICS 文件（每队两份）
├── data/
│   ├── csl_meta.yaml        # 联赛元信息（球队、时区、模板等）
│   └── csl_fixtures.csv     # 赛程与抢票时间数据
├── script/
│   └── generate_csl_ics.py  # 从 data 生成 ICS 的脚本
├── .nojekyll
├── index.html               # GitHub Pages 首页（订阅入口）
├── requirements.txt
└── README.md
```

## 数据说明

### `data/csl_meta.yaml`

包含以下核心字段：
- `league_id`, `league_name`, `season`
- `timezone`
- `default_match_duration_minutes`
- `calendar_name_template`, `calendar_with_ticket_name_template`
- `source_file`
- `teams`（每项含 `code` 与 `name`）

### `data/csl_fixtures.csv`

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
- `status`

时间字段使用 ISO-8601 格式，例如：`2026-03-06T19:35:00+08:00`。

## 使用方式

1. 安装依赖：

```bash
pip install -r requirements.txt
```

2. 生成/更新 `ics`：

```bash
python script/generate_csl_ics.py
```

默认读取：
- 元信息：`data/csl_meta.yaml`
- 赛程：由 `csl_meta.yaml` 中 `source_file` 指定
- 输出目录：`calendar/`

可选参数：

```bash
python script/generate_csl_ics.py --meta data/csl_meta.yaml --output-dir calendar
```

## 输出文件命名

每支球队输出两份文件：
- `calendar/csl_<team-code>.ics`
- `calendar/csl_<team-code>_with_ticket.ics`

示例：
- `calendar/csl_beijing-guoan.ics`
- `calendar/csl_beijing-guoan_with_ticket.ics`

## 更新流程（无 GitHub Action）

推荐流程：
1. 更新 `data/csl_fixtures.csv` 赛程/抢票信息。
2. 执行 `python script/generate_csl_ics.py`。
3. 提交 `calendar/` 下更新后的 `ics` 文件。

## GitHub Pages（vamosdalian/sports-calendar）

本仓库已提供 Pages 首页文件：`index.html` + `assets/site.css`。

### 开启步骤

1. 将代码推送到 GitHub 仓库 `vamosdalian/sports-calendar`。
2. 进入仓库 `Settings` -> `Pages`。
3. `Build and deployment` 选择 `Deploy from a branch`。
4. `Branch` 选择 `main`（或你的默认分支），`Folder` 选择 `/ (root)`。
5. 保存后等待发布完成。

### 访问地址

- 首页：`https://vamosdalian.github.io/sports-calendar/`
- ICS 文件示例：`https://vamosdalian.github.io/sports-calendar/calendar/csl_beijing-guoan.ics`

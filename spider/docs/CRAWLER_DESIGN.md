# 抓取系统设计方案

> 状态:**已实现**(2026-06)。本文档是数据库与遍历逻辑的设计规格。
>
> ⚠️ 数据库结构已重写,旧表(clubs/scrape_jobs 等)不兼容。开发环境需重建:
> `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` 后由 `init_db()` 重新建表。

## 1. 设计原则

- **以国家为种子的图遍历**:从 254 个国家出发,沿「国家 → 国家队/联赛 → 比赛 → 赛事/对手 → 球队 → 球员」逐层下钻。
- **id 即去重键**:国家、赛事、球队(俱乐部+国家队)、球员在 TM 都有稳定 id;凡是 `(实体, id)` 或 `(实体, id, 赛季)` 抓过的不再抓。
- **从赛程反推赛事**:不预设赛事清单;看每支队伍的比赛,自动发现它参加的赛事(含国际赛、洲际俱乐部杯)。
- **零写死种子**:唯一入口是 `quickselect/countries`,外加大洲/FIFA 页作兜底。
- **优先 JSON 接口**:`quickselect` 能拿的就不爬 HTML。

## 2. 已确认的关键决策

1. **球队合一**:国家队 + 俱乐部存同一张 `teams` 表,用 `kind` 区分。
2. **任务统一**:废弃 `scrape_jobs`,手动与自动抓取都走 `crawl_tasks` 队列。
3. **国家队范围**:A 队 + 青年梯队 + 女足全部入库(后续可用 `priority` 控制先后)。
4. **交互式 tree 驱动遍历**:不做一键全量。前端用一棵**懒加载的树**让用户逐层选择要抓什么(国家 → 该国赛事/国家队 → 赛季 → 球队 → …),勾选后才下发深度抓取任务。
5. **赛事类型**:`competitions.type` 必须明确区分**联赛 / 杯赛**(抓取方式、赛季来源、有无积分榜都不同)。
6. **球员详情**:抓 `player_profile`(生日、国籍、身高、惯用脚、身价等)。
7. **历史深度**:历史赛季只抓**近 5 年**。
8. **不要 confederation 字段**:`countries` 和 `competitions` 都不加 confederation/主办方字段。
9. **前端同步优化**:保留并改造现有 `web/`,新增树形选择 + 任务进度界面。

## 3. 实体关系

```
Country (国家, id)
 ├─< Team (kind=national 国家队 / kind=club 俱乐部, id, country_id)
 │     ├─< TeamCompetitionSeason (某队某赛季参加某赛事)
 │     └─< PlayerTeamSeason (某队某赛季的某球员)
 ├─< Competition (赛事, id, country_id 可空)
 │     ├─ seasons (该赛事真实赛季列表, jsonb)
 │     ├─< Standing (积分榜行: 赛事×赛季×队)
 │     └─< Fixture (比赛: 赛事×赛季, home_team/away_team)
 └  (国际赛事 country_id = NULL)
Player (球员, id)
CrawlTask (抓取队列 / 去重账本)
RawSnapshot (原始 HTML 快照)
```

## 4. 表设计

### 4.1 `countries`
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int PK | TM flag id(England=189) |
| `name` | str | 国家名 |
| `url` | str | `/wettbewerbe/national/wettbewerbe/{id}` |
| `last_crawled_at` | ts? | 上次成功抓取,用于刷新判断 |
| `created_at/updated_at` | ts | |

### 4.2 `teams`(国家队 + 俱乐部)
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | TM verein id(England=3299, Mexico=6303) |
| `kind` | enum | `national` / `club` |
| `name` | str | |
| `slug` | str? | |
| `country_id` | int FK→countries | 国家队=代表国;俱乐部=注册国 |
| `parent_team_id` | bigint? | 梯队归属(U21→A 队),可空 |
| `url` | str | `/{slug}/startseite/verein/{id}` |
| `last_crawled_at` | ts? | |
| `extra` | jsonb? | 身价、阵容规模等 |

### 4.3 `competitions`(在现有基础上调整)
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | str PK | TM code(GB1/CL/FIWC) |
| `name / slug / tier / logo_url` | | 沿用现有 |
| `type` | enum | **`league` / `cup`**(+ `international`/`other`);区分联赛与杯赛,决定赛季来源、有无积分榜、URL 段(`wettbewerb` vs `pokalwettbewerb`) |
| `country_id` | int? FK→countries | **可空**(国际赛事为空) |
| `kind_of_teams` | enum? | 参赛主体 `club`/`national`(欧冠=club,世界杯=national) |
| `seasons` | jsonb | 真实赛季列表(沿用) |
| `last_crawled_at` | ts? | |
| `extra` | jsonb? | |

### 4.4 `team_competition_seasons`(替代 `club_seasons`)
- 唯一键 `(team_id, competition_id, season_id)`。
- 字段:`squad_size, avg_age, foreigners, market_value, extra`(沿用 club_seasons)。

### 4.5 `players`(沿用现有)+ `player_team_seasons`(替代 `player_club_seasons`)
- `player_team_seasons`:把 `club_id` 改为 `team_id`(国家队名单也能存)。
- 唯一键 `(player_id, team_id, season_id)`;字段:`shirt_number, market_value, contract_until, extra`。

### 4.6 `fixtures`(在现有基础上泛化)
- `home_club_id/away_club_id` → `home_team_id/away_team_id`(指向 teams,俱乐部和国家队通用)。
- 保留 `match_id`(唯一)、`competition_id`、`season_id`、`kickoff`、`home_score/away_score`、`matchday`、`extra`。
- **反推赛事的核心数据源**。

### 4.7 `standings`(新增,对应"table")
- 唯一键 `(competition_id, season_id, team_id)`。
- 字段:`rank, played, win, draw, loss, goals_for, goals_against, goal_diff, points, group`(小组赛用 group)。
- 仅联赛/小组赛有;淘汰赛/友谊赛无积分榜。

### 4.8 `crawl_tasks`(新增,实现"搜过不再搜",取代 `scrape_jobs`)
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `kind` | enum | **竞赛维度(主轴)**:`competition_clubs`(参赛队→参赛记录,并派生各队阵容)/ `competition_standings` / `competition_fixtures`。**球队维度**:`team_fixtures` / `team_squad`(国家队/反推发现)/ `player_profile` / `fallback_discovery`。展开操作同步,不入此表 |
| `target_id` | str | 实体 id |
| `season_id` | int? | 需要赛季维度的任务才填 |
| `status` | enum | pending/running/done/failed/skipped |
| `priority` | int | 调度优先级(热门国家/五大联赛/A 队优先) |
| `attempts / last_error` | int / text | 重试与错误 |
| `scheduled_at / started_at / finished_at` | ts | |

- 唯一约束 `(kind, target_id, season_id)` → **天然去重**:任务已存在即跳过。

### 4.9 `raw_snapshots`(保持现状)
沿用已实现的写入逻辑(成功抓页后落库,验证码页不存)。

## 5. 遍历策略(交互式 tree 驱动,非全量)

分两种操作,严格区分:

- **展开(expand)**:轻量、即时。点开树节点时,只拉取**下一层的清单**(id/name/url)并 upsert 实体行(不抓深度数据)。尽量走 `quickselect` JSON。
- **抓取(ingest)**:重量、异步。用户在树上勾选节点 + 选范围后,才下发 `crawl_tasks`,worker 后台把选中子树的完整数据(赛程/积分榜/阵容/球员详情)按近 5 季抓全。

### 5.1 选择树(懒加载层级)

```
[国家]  (root: quickselect/countries)
  ├─ 国家队           (展开: 国家页「国家队」box → teams kind=national)
  │    └─ 国家队 X
  │         └─ 赛季(近5年)  →  赛程 / 阵容 / 球员
  └─ 赛事             (展开: quickselect/competitions/{countryId} 或国家页)
       └─ 赛事 Y (联赛/杯赛)
            └─ 赛季(近5年)  →  积分榜(仅联赛/小组赛) / 参赛队
                 └─ 球队(俱乐部)
                      └─ 赛程 / 阵容 / 球员
```

> 用户可以只展开到任意一层就停;勾选某层节点 = 抓取该节点及其(可配置的)子内容。

### 5.2 展开边(点开即拉清单,轻量 upsert)

| 展开节点 | 拉取 | 写入 |
|---|---|---|
| root | `quickselect/countries` | upsert `countries`(254) |
| 国家 → 国家队 | 国家页「国家队」box | upsert teams(kind=national) |
| 国家 → 赛事 | `quickselect/competitions/{id}` | upsert competitions(带 type 联赛/杯赛) |
| 赛事 → 赛季 | 赛事 saison_id 下拉 | 写 `competitions.seasons`,只展示近 5 季 |
| 赛季 → 参赛队 | `quickselect/teams/{compId}`(当季)/ 积分榜页(历史季) | upsert teams(kind=club) |

### 5.3 抓取任务(勾选后下发 `crawl_tasks`)

| 任务 kind | 输入 | 动作 |
|---|---|---|
| `competition_standings` | comp_id, season | 写 `standings`(仅 league/小组赛);发现参赛俱乐部 → upsert |
| `team_fixtures` | team_id, season | 写 `fixtures`;**反推赛事**:遇未知 comp → upsert(自动发现世界杯/欧冠/洲际杯);遇未知对手 → upsert |
| `team_squad` | team_id, season | upsert players + `player_team_seasons`;每名球员入队 `player_profile` |
| `player_profile` | player_id | 抓球员详情页 → 生日/国籍/身高/惯用脚/身价 |
| `fallback_discovery`(可选) | fifa + 各洲页 | `Cups`/`International cups` box 补冷门赛事 |

**赛季范围**:`team_fixtures / team_squad / competition_standings` 默认抓**近 5 季**(以赛事真实 saison_id 列表的最近 5 个为准)。

**去重**:入队前查 `crawl_tasks` 唯一键 `(kind, target_id, season_id)`;实体行用 `last_crawled_at` 判断是否过期需刷新。已抓过的 id/赛季不重复下发。

**调度**:单 worker 串行(受全局限速 + WAF 制约);`priority` 让用户先勾的先跑;失败按 `attempts` 退避重试;命中验证码全局暂停(沿用 `fetcher.state`)。

## 6. 字段来源映射

| 数据 | 来源 |
|---|---|
| 国家列表 | `quickselect/countries` |
| 国家队列表 | 国家页「国家队」box |
| 某国赛事 | `quickselect/competitions/{countryId}` 或国家页 |
| 当前阵容 | `quickselect/players/{teamId}`(仅当前赛季) |
| 历史阵容/赛程/积分榜 | 对应 HTML 页 + `saison_id` |
| 赛事真实赛季 | 赛事页 saison_id 下拉 |
| 国际赛事/洲际杯 | 球队赛程反推 + fifa/Cups 兜底 |

## 7. 相对现有 schema 的迁移

- `clubs` → `teams`(+`kind`+`country_id`+`parent_team_id`)
- `club_seasons` → `team_competition_seasons`
- `player_club_seasons` → `player_team_seasons`(`club_id`→`team_id`)
- `fixtures` 的 club 字段 → team 字段
- `competitions` 加 `country_id(FK,可空)`、`confederation`、`kind_of_teams`、`last_crawled_at`
- 新增 `countries`、`standings`、`crawl_tasks`
- 删除 `scrape_jobs`(逻辑并入 `crawl_tasks`)
- `raw_snapshots` 不变

## 8. 前端(`web/` 改造)

- **选择树**:懒加载的层级树(§5.1),点开拉下一层清单,带勾选框。
- **范围选择**:勾选节点后选抓取范围(赛程 / 积分榜 / 阵容 / 球员详情),默认近 5 季。
- **任务面板**:展示 `crawl_tasks` 队列与进度、失败重试、验证码暂停提示(沿用 `fetcher.state`)。
- **数据浏览**:按 国家 / 赛事 / 球队 / 球员 查看已抓数据。

## 9. 已定结论(原开放问题)

- ✅ 抓 `player_profile`(球员详情,字段沿用现有 `players` 表)。
- ✅ 历史赛季只抓**近 5 年**。
- ✅ 保留并改造现有 `web/` 前端。
- ✅ `countries` / `competitions` **不加** confederation 字段。
- ✅ `competitions.type` 明确区分联赛/杯赛。

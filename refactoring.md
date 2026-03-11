# Refactoring Document

## description

该文档用以重构整个项目说明，具体说明了当前项目的状态以及需要进行的修改，最终完成的状态，在完成后会删除本文档

## current

当前项目是给用户提供比赛日历同时可以订阅 ics 的网站，域名是 sports-calendar.com，使用 github page 负载前端，github 仓库直接提供数据，目前仅包含了 中超的数据，并且需要手动更改 data，其他的具体可以查看当前目录架构

## update

重构需要舍弃当前的架构和数据，重新使用新架构：

### 前端：

前端放到 web 目录下

使用 next.js 生成项目,使用 app router 生成 ssr 支持 isr，并使用 i18n 组件，还有 sitemap 组件生成网站地图还有 robottxt，使用 tailwinds，其他组件我还没列出，但是需要你来推断

前端 url 格式为 sports-calendar.com/[language]/[sports]/[league]/[season]/index.html
例如： 
- sports-calendar.com/zh/football/csl/2026/index.html
- sports-calendar.com/en/racing/f1/2026/index.html

所有页面遵循如下设计：
网页端页面宽度为 1200，其他部分以 #F7F8F0 填充
页头和页脚以 #355872 作为背景色，页头左侧写 sports-calendar.com 右侧按钮可以选择语言
main 区域左右分割布局，左侧背景颜色 #7AAACE 右侧背景颜色 #9CD5FF 
左侧从上往下依次是年份选择框，然后是在该年的所有的比赛
右侧从上往下依次是
1. 日历，一行三个，一共四行，共 12 个月的日历
2. 日历描述，列举该比赛在该年所有的比赛，用 list 即可
3. 数据源说明
4. 备注

移动端不需要白色填充后面，因为页面很窄，直接就页头和页脚，页头下面就是 main 区域
main 区域 日历一行两个，一共 6 行，剩下的和网页端右侧一样

前端改为使用 cloudflare page 部署，但不用你来操作，你给我写一个文档，说明如何在 cloudflare page 部署这个，别忘了查询最新的文档

### 后端

后端放到 backend 目录下

使用 golang 作为首选语言，[go-icals](https://github.com/emersion/go-ical)作为日历库，gin 作为 web 框架，logrus 作为 log库，以及其他的需要的库
配置文件使用 yaml
单元测试与集成测试
注意接口限流

后端域名： api.sports-calendar.com

后端 api 列表：
GET /api/sports?year=2026 #获取该年度的所有比赛类型
GET /api/sports/:league[/:season] #获取某一种类型比赛的该年度所有比赛,season默认为当前年
GET /ics/:sports/:league/:season/matches.ics #获取某一个联赛该年度所有比赛的赛历，可以导入日历，注意缓存

后端定期用 cron 库从 api-sports.io 网站获取数据同步数据库，这块你先预留好，先用 mock 数据

后端先用 docker build 作为 ci，都没有问题我再迁移

### 数据库

数据库使用 postgres

至少有 leagues,teams,matches 三个表，因为前端有 i18n，所以有些名字字段需要加一个 jsonb 类型的 language 使用
这个你来规划数据库的设计


### 其他

不需要用户表，不需要邮件或微信推送
import type { Locale } from "./site";

export type Dictionary = {
  siteName: string;
  homeTitle: string;
  homeLead: string;
  exploreLabel: string;
  seasonLabel: string;
  matchesLabel: string;
  calendarLabel: string;
  calendarDescriptionLabel: string;
  dataSourceLabel: string;
  notesLabel: string;
  allMatchesLabel: string;
  noMatches: string;
  viewSeason: string;
  languageLabel: string;
  finished: string;
  scheduled: string;
  venueLabel: string;
  cityLabel: string;
  ticketOpenLabel: string;
  updatedAtLabel: string;
  byRoundLabel: string;
};

const dictionaries: Record<Locale, Dictionary> = {
  en: {
    siteName: "sports-calendar.com",
    homeTitle: "Season calendars for football and racing",
    homeLead: "A refactored front-end prototype powered by shared mock data and ready to switch to the Go API.",
    exploreLabel: "Explore seasons",
    seasonLabel: "Season",
    matchesLabel: "Matches this season",
    calendarLabel: "Calendar",
    calendarDescriptionLabel: "Calendar description",
    dataSourceLabel: "Data source",
    notesLabel: "Notes",
    allMatchesLabel: "All fixtures in this season",
    noMatches: "No matches available for this season.",
    viewSeason: "Open season",
    languageLabel: "Language",
    finished: "Finished",
    scheduled: "Scheduled",
    venueLabel: "Venue",
    cityLabel: "City",
    ticketOpenLabel: "Ticket opens",
    updatedAtLabel: "Catalog updated",
    byRoundLabel: "Round",
  },
  zh: {
    siteName: "sports-calendar.com",
    homeTitle: "覆盖足球与赛车的赛季日历",
    homeLead: "这是基于共享 mock 数据驱动的重构前端原型，后续可以直接切换到 Go API。",
    exploreLabel: "浏览赛季",
    seasonLabel: "赛季",
    matchesLabel: "本赛季比赛",
    calendarLabel: "日历",
    calendarDescriptionLabel: "日历描述",
    dataSourceLabel: "数据源说明",
    notesLabel: "备注",
    allMatchesLabel: "该赛季全部比赛",
    noMatches: "当前赛季暂无比赛数据。",
    viewSeason: "打开赛季页面",
    languageLabel: "语言",
    finished: "已结束",
    scheduled: "已排期",
    venueLabel: "场地",
    cityLabel: "城市",
    ticketOpenLabel: "开票时间",
    updatedAtLabel: "数据更新时间",
    byRoundLabel: "轮次",
  },
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
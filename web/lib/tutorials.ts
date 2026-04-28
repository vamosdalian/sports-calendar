import type { Locale } from "./site";

export type TutorialStep = {
  title: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
};

export type TutorialDocument = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  note?: string;
  steps: TutorialStep[];
};

const iosSubscriptionTutorials: Record<Locale, TutorialDocument> = {
  en: {
    slug: "how-to-subscribe-ios",
    title: "How to subscribe on iPhone Calendar",
    description: "Open sports-calendar.com on your iPhone and subscribe to a season feed in the iOS Calendar app.",
    intro: "This guide shows the exact iPhone flow for opening a competition page, subscribing to its calendar feed, and checking the imported matches in Calendar.",
    steps: [
      {
        title: "Open sports-calendar.com in your browser",
        body: "Type `sports-calendar.com` into Chrome or Safari on your iPhone and open the site homepage.",
        imageSrc: "/turtorial/ios_en_1.jpg",
        imageAlt: "Entering sports-calendar.com in the iPhone browser address bar.",
      },
      {
        title: "Choose a competition from the directory",
        body: "From the homepage, open the league or competition that you want to follow.",
        imageSrc: "/turtorial/ios_en_2.jpg",
        imageAlt: "The English homepage showing the sports directory and league links.",
      },
      {
        title: "Open the season page and tap Subscribe",
        body: "On the season page, confirm the competition and season, then tap the `Subscribe` button.",
        imageSrc: "/turtorial/ios_en_3.jpg",
        imageAlt: "A season page with the Subscribe button visible near the filters.",
      },
      {
        title: "Confirm the subscription URL",
        body: "iPhone will open the subscription prompt automatically. Tap `Subscribe` to continue.",
        imageSrc: "/turtorial/ios_en_4.jpg",
        imageAlt: "The Add Subscription Calendar dialog showing the feed URL and Subscribe button.",
      },
      {
        title: "Review the imported calendar details",
        body: "You can change the title, account, color, or notifications if needed. Then tap `Add` in the top-right corner.",
        imageSrc: "/turtorial/ios_en_5.jpg",
        imageAlt: "The iOS calendar subscription review screen with preview events and the Add button.",
      },
      {
        title: "Check the subscribed matches in Calendar",
        body: "After adding it, the season schedule appears in the Calendar app and updates automatically when the source feed changes.",
        imageSrc: "/turtorial/ios_en_6.jpg",
        imageAlt: "The iPhone Calendar month view showing imported match events.",
      },
      {
        title: "Open an event to verify details",
        body: "Each event includes the match title, time, venue, and notes from the feed.",
        imageSrc: "/turtorial/ios_en_7.jpg",
        imageAlt: "An event details screen showing fixture information imported from the calendar feed.",
      },
    ],
  },
  zh: {
    slug: "how-to-subscribe-ios",
    title: "如何在 iPhone 日历中订阅赛程",
    description: "在 iPhone 上打开 sports-calendar.com，并将赛季赛程订阅到 iOS 日历。",
    intro: "这个教程按实际 iPhone 操作流程展示：打开联赛页面、订阅赛程源，再到系统日历里确认比赛已经导入。",
    steps: [
      {
        title: "在浏览器中打开 sports-calendar.com",
        body: "在 iPhone 的 Chrome 或 Safari 地址栏输入 `sports-calendar.com`，进入网站首页。",
        imageSrc: "/turtorial/ios_zh_1.jpg",
        imageAlt: "在 iPhone 浏览器地址栏中输入 sports-calendar.com。",
      },
      {
        title: "从目录中进入你要订阅的赛事",
        body: "在首页选择你想关注的联赛或赛事，进入对应赛季页面。",
        imageSrc: "/turtorial/ios_zh_2.jpg",
        imageAlt: "中文首页展示赛事目录和联赛入口。",
      },
      {
        title: "确认赛季后点击订阅",
        body: "在赛季页确认赛事和年份，然后点击右侧的“订阅”按钮。",
        imageSrc: "/turtorial/ios_zh_3.jpg",
        imageAlt: "赛季页面中显示订阅按钮。",
      },
      {
        title: "在系统弹窗中确认订阅链接",
        body: "iPhone 会自动打开“添加订阅日历”弹窗，点击“订阅”继续。",
        imageSrc: "/turtorial/ios_zh_4.jpg",
        imageAlt: "iOS 添加订阅日历弹窗，展示订阅 URL 和订阅按钮。",
      },
      {
        title: "检查导入信息后点击添加",
        body: "你可以在这里查看名称、预览赛程、账户、颜色和提醒设置，确认后点击右上角“添加”。",
        imageSrc: "/turtorial/ios_zh_5.jpg",
        imageAlt: "iOS 日历订阅确认页，显示预览赛程和添加按钮。",
      },
      {
        title: "在日历中查看已同步的比赛",
        body: "添加完成后，比赛会出现在系统日历里；当源数据更新时，这个订阅日历也会自动同步。",
        imageSrc: "/turtorial/ios_zh_6.jpg",
        imageAlt: "iPhone 日历月视图中显示已导入的比赛事件。",
      },
      {
        title: "打开单场比赛查看详情",
        body: "点开任意一场比赛，可以看到比赛名称、时间、场地和备注等信息。",
        imageSrc: "/turtorial/ios_zh_7.jpg",
        imageAlt: "比赛详情页展示了导入后的赛程信息。",
      },
    ],
  },
};

export function getTutorial(locale: Locale, slug: string): TutorialDocument | null {
  const tutorial = iosSubscriptionTutorials[locale];
  if (tutorial?.slug === slug) {
    return tutorial;
  }

  return null;
}

export function getTutorialSlugs() {
  return ["how-to-subscribe-ios"];
}

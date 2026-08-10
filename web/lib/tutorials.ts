import type { Locale } from "./site";

export type TutorialStep = {
  title: string;
  body: string;
  path: string[];
  result: string;
};

export type TutorialSource = {
  label: string;
  href: string;
};

export type TutorialDocument = {
  slug: string;
  accent: "apple" | "google" | "outlook";
  service: string;
  device: string;
  title: string;
  description: string;
  intro: string;
  duration: string;
  linkType: string;
  availability: string;
  prerequisites: string[];
  steps: TutorialStep[];
  notes: string[];
  source: TutorialSource;
};

export type TutorialIndexCopy = {
  eyebrow: string;
  title: string;
  description: string;
  chooseTitle: string;
  chooseBody: string;
  importantTitle: string;
  importantBody: string;
  openGuideLabel: string;
  durationLabel: string;
  linkTypeLabel: string;
  availabilityLabel: string;
  principlesTitle: string;
  principles: Array<{ title: string; body: string }>;
};

const tutorials: Record<Locale, TutorialDocument[]> = {
  en: [
    {
      slug: "how-to-subscribe-ios",
      accent: "apple",
      service: "Apple Calendar",
      device: "iPhone & iPad",
      title: "Subscribe on iPhone or iPad",
      description: "Add a live sports schedule to Apple Calendar on iPhone or iPad and keep future changes in sync.",
      intro: "The Add to Calendar button opens Apple Calendar with the subscription address already filled in. Subscribe once; do not download and re-import the schedule for every update.",
      duration: "About 1 minute",
      linkType: "Direct subscription",
      availability: "Completed on iPhone or iPad",
      prerequisites: [
        "Open sports-calendar.com on the iPhone or iPad where you use Apple Calendar.",
        "Choose the competition, season, or team you want to follow before starting.",
      ],
      steps: [
        {
          title: "Open the schedule you want",
          body: "Go to a competition, season, or team page and check that you have selected the right schedule. Team pages subscribe only to that team's matches.",
          path: ["Schedule page", "Add to Calendar"],
          result: "Apple Calendar opens the subscription flow.",
        },
        {
          title: "Confirm the subscription",
          body: "Review the calendar address shown by iOS, then tap Subscribe. A subscription stays connected to the source so fixture changes can arrive later.",
          path: ["Add Subscription Calendar", "Subscribe"],
          result: "iOS loads a preview of the calendar.",
        },
        {
          title: "Review the calendar settings",
          body: "Change the name, account, color, or event alerts if needed. Keep the calendar in iCloud if you want it available on your other Apple devices.",
          path: ["Subscription details", "Add"],
          result: "The subscribed calendar is saved.",
        },
        {
          title: "Check the imported matches",
          body: "Open Calendar and select the new calendar in the calendar list. Open any match to check its local time, venue, and notes.",
          path: ["Calendar", "Calendars", "Subscribed calendar"],
          result: "Matches appear and future source updates can sync automatically.",
        },
      ],
      notes: [
        "If the Add to Calendar button does not open Calendar, copy the subscription link. In Calendar, go to Calendars → Add Calendar → Add Subscription Calendar and paste the address.",
        "A subscribed calendar is read-only. Match changes come from sports-calendar.com rather than edits made in Apple Calendar.",
      ],
      source: {
        label: "Apple Support: Set up multiple calendars on iPhone",
        href: "https://support.apple.com/guide/iphone/set-up-multiple-calendars-iph3d1110d4/ios",
      },
    },
    {
      slug: "how-to-subscribe-mac",
      accent: "apple",
      service: "Apple Calendar",
      device: "Mac",
      title: "Subscribe in Calendar on Mac",
      description: "Add a live sports schedule to Apple Calendar on Mac and choose how often it refreshes.",
      intro: "On a Mac, the subscription link opens Calendar and fills in the calendar address for you. Saving it to iCloud also makes it available on your other Apple devices.",
      duration: "About 2 minutes",
      linkType: "Direct subscription",
      availability: "Completed on Mac",
      prerequisites: [
        "Open sports-calendar.com in a browser on your Mac.",
        "Make sure the Calendar app is set up with the account where you want the schedule stored.",
      ],
      steps: [
        {
          title: "Open the schedule you want",
          body: "Choose the competition, season, or team you want to follow, then click Add to Calendar.",
          path: ["Schedule page", "Add to Calendar"],
          result: "Your browser asks to open Calendar.",
        },
        {
          title: "Allow the browser to open Calendar",
          body: "Confirm the browser prompt. Calendar opens with the sports-calendar.com subscription address already filled in.",
          path: ["Browser prompt", "Open Calendar"],
          result: "The New Calendar Subscription dialog appears.",
        },
        {
          title: "Start the subscription",
          body: "Check the web address and click Subscribe. Use the copied HTTPS subscription link if you need to enter the address manually.",
          path: ["New Calendar Subscription", "Subscribe"],
          result: "Calendar shows the subscription settings.",
        },
        {
          title: "Choose location and refresh frequency",
          body: "Give the calendar a clear name, choose a color, and select iCloud as the location if you want it on your other Apple devices. Choose an automatic refresh interval, then click OK.",
          path: ["Name & color", "Location & Auto-refresh", "OK"],
          result: "The schedule is saved and Calendar refreshes it automatically.",
        },
        {
          title: "Verify the calendar",
          body: "Find the new calendar in the sidebar and open a match to check the time, venue, and notes.",
          path: ["Calendar list", "Subscribed calendar", "Match"],
          result: "The live schedule is ready to use.",
        },
      ],
      notes: [
        "Manual fallback: in Calendar choose File → New Calendar Subscription, then paste the copied subscription address.",
        "Choose iCloud instead of On My Mac when you want the subscription to appear on your iPhone or iPad too.",
      ],
      source: {
        label: "Apple Support: Subscribe to calendars on Mac",
        href: "https://support.apple.com/guide/calendar/subscribe-to-calendars-icl1022/mac",
      },
    },
    {
      slug: "how-to-subscribe-google-calendar",
      accent: "google",
      service: "Google Calendar",
      device: "Computer, then Android or iPhone",
      title: "Subscribe in Google Calendar",
      description: "Add a sports schedule to Google Calendar from a URL, then view it in the Google Calendar mobile app.",
      intro: "Google only allows new URL subscriptions from a computer browser. Add the calendar once on the web; it will then appear in Google Calendar on Android, iPhone, and iPad when you use the same Google account.",
      duration: "About 2 minutes",
      linkType: "Copy HTTPS subscription link",
      availability: "Added on computer; viewed on mobile",
      prerequisites: [
        "Use a desktop or laptop browser. The Google Calendar mobile app cannot add a new calendar from a URL.",
        "Sign in to the Google account you also use in the mobile app.",
      ],
      steps: [
        {
          title: "Copy the schedule subscription link",
          body: "Open the competition, season, or team page you want and choose Copy subscription link. For Google Calendar, copy the HTTPS address instead of opening the webcal link.",
          path: ["Schedule page", "Copy subscription link"],
          result: "The live .ics address is copied to your clipboard.",
        },
        {
          title: "Open Google Calendar on a computer",
          body: "Go to calendar.google.com in a desktop browser and confirm that you are signed in to the correct Google account.",
          path: ["calendar.google.com", "Correct Google account"],
          result: "Your main Google Calendar opens.",
        },
        {
          title: "Choose From URL",
          body: "In the left sidebar, find Other calendars, select Add other calendars (+), then choose From URL.",
          path: ["Other calendars", "+", "From URL"],
          result: "Google shows the URL field.",
        },
        {
          title: "Paste the address and add the calendar",
          body: "Paste the copied HTTPS subscription address and select Add calendar. Do not download and import an .ics file; importing creates a snapshot that will not follow future updates.",
          path: ["URL of calendar", "Add calendar"],
          result: "The schedule appears under Other calendars.",
        },
        {
          title: "Check it on your phone",
          body: "Open the Google Calendar app with the same account. If the schedule is hidden, open the app menu and enable the new calendar.",
          path: ["Google Calendar app", "Menu", "Enable calendar"],
          result: "The subscribed matches are visible on Android, iPhone, or iPad.",
        },
      ],
      notes: [
        "Google Calendar does not support adding a URL subscription inside its Android, iPhone, or iPad app. Use a computer browser for the initial setup.",
        "Google controls how frequently subscribed calendars refresh, so a source change may not appear immediately.",
      ],
      source: {
        label: "Google Calendar Help: Use a link to add a public calendar",
        href: "https://support.google.com/calendar/answer/37100?co=GENIE.Platform%3DDesktop&hl=en",
      },
    },
    {
      slug: "how-to-subscribe-outlook",
      accent: "outlook",
      service: "Outlook Calendar",
      device: "Outlook on the web",
      title: "Subscribe in Outlook Calendar",
      description: "Subscribe to a live sports schedule in Outlook on the web and keep fixture changes updating.",
      intro: "Use Subscribe from web in Outlook Calendar. This creates a live subscription; uploading an .ics file only imports a fixed snapshot and should not be used for schedules that change.",
      duration: "About 2 minutes",
      linkType: "Copy HTTPS subscription link",
      availability: "Added in Outlook on the web",
      prerequisites: [
        "Sign in to Outlook.com or Outlook on the web in a desktop browser.",
        "Use the same Microsoft account that you use in Outlook on your other devices.",
      ],
      steps: [
        {
          title: "Copy the schedule subscription link",
          body: "Open the competition, season, or team page you want and choose Copy subscription link. Outlook needs the HTTPS calendar address.",
          path: ["Schedule page", "Copy subscription link"],
          result: "The live .ics address is copied to your clipboard.",
        },
        {
          title: "Open Outlook Calendar",
          body: "Sign in to Outlook.com or your organization's Outlook on the web, then open Calendar from the navigation pane.",
          path: ["Outlook on the web", "Calendar"],
          result: "The Outlook calendar view opens.",
        },
        {
          title: "Choose Subscribe from web",
          body: "Select Add calendar, then choose Subscribe from web. Wording can vary slightly between personal and work or school accounts.",
          path: ["Add calendar", "Subscribe from web"],
          result: "Outlook shows the subscription address field.",
        },
        {
          title: "Paste and save",
          body: "Paste the copied HTTPS address, choose a recognizable name and color if offered, then select Import or Save.",
          path: ["Calendar URL", "Name & color", "Import / Save"],
          result: "The schedule is added as a subscribed calendar.",
        },
        {
          title: "Verify the subscription",
          body: "Find the calendar in the sidebar and open a match. It will also be available in Outlook apps signed in to the same account.",
          path: ["Calendar list", "Subscribed calendar", "Match"],
          result: "The live schedule is ready and can receive future updates.",
        },
      ],
      notes: [
        "Always choose Subscribe from web. Upload from file imports a one-time snapshot and does not automatically receive fixture changes.",
        "Microsoft notes that updates to subscribed calendars can take more than 24 hours to appear.",
      ],
      source: {
        label: "Microsoft Support: Import or subscribe to a calendar in Outlook",
        href: "https://support.microsoft.com/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web",
      },
    },
  ],
  zh: [
    {
      slug: "how-to-subscribe-ios",
      accent: "apple",
      service: "Apple 日历",
      device: "iPhone 与 iPad",
      title: "在 iPhone 或 iPad 上订阅赛程",
      description: "在 iPhone 或 iPad 上将实时赛程添加到 Apple 日历，并自动接收后续变更。",
      intro: "“添加到日历”会直接打开 Apple 日历，并自动填好订阅地址。只需订阅一次；赛程变化后不需要反复下载和导入。",
      duration: "约 1 分钟",
      linkType: "直接订阅",
      availability: "在 iPhone 或 iPad 上完成",
      prerequisites: [
        "请在使用 Apple 日历的 iPhone 或 iPad 上打开 sports-calendar.com。",
        "开始前先选好要关注的赛事、赛季或球队。",
      ],
      steps: [
        {
          title: "打开需要的赛程",
          body: "进入赛事、赛季或球队页面，确认当前选择正确。球队页面只会订阅这支球队的比赛。",
          path: ["赛程页面", "添加到日历"],
          result: "系统进入 Apple 日历订阅流程。",
        },
        {
          title: "确认订阅",
          body: "检查 iOS 显示的日历地址，然后点击“订阅”。订阅会持续连接数据源，以便之后接收赛程调整。",
          path: ["添加订阅日历", "订阅"],
          result: "iOS 加载日历内容预览。",
        },
        {
          title: "检查日历设置",
          body: "按需修改名称、账户、颜色或提醒。如果希望在其他 Apple 设备上查看，请将日历保存在 iCloud。",
          path: ["订阅详情", "添加"],
          result: "订阅日历保存成功。",
        },
        {
          title: "检查已同步的比赛",
          body: "打开“日历”，在日历列表中启用刚添加的日历。打开任意比赛即可检查本地时间、场地和备注。",
          path: ["日历", "日历列表", "已订阅的日历"],
          result: "比赛已经出现，后续数据变化可以自动同步。",
        },
      ],
      notes: [
        "如果“添加到日历”没有打开系统日历，请复制订阅链接，然后依次进入：日历 → 日历列表 → 添加日历 → 添加订阅日历，并粘贴地址。",
        "订阅日历是只读的。比赛变化由 sports-calendar.com 更新，不能在 Apple 日历里直接修改。",
      ],
      source: {
        label: "Apple 支持：在 iPhone 上设置多个日历",
        href: "https://support.apple.com/zh-cn/guide/iphone/iph3d1110d4/ios",
      },
    },
    {
      slug: "how-to-subscribe-mac",
      accent: "apple",
      service: "Apple 日历",
      device: "Mac",
      title: "在 Mac 日历中订阅赛程",
      description: "在 Mac 的 Apple 日历中添加实时赛程，并设置自动刷新频率。",
      intro: "在 Mac 上点击订阅链接后，系统会打开“日历”并自动填入地址。把订阅位置设为 iCloud，还可以让它出现在其他 Apple 设备上。",
      duration: "约 2 分钟",
      linkType: "直接订阅",
      availability: "在 Mac 上完成",
      prerequisites: [
        "在 Mac 浏览器中打开 sports-calendar.com。",
        "确认“日历”App 已经登录你准备保存赛程的账户。",
      ],
      steps: [
        {
          title: "打开需要的赛程",
          body: "选择要关注的赛事、赛季或球队，然后点击“添加到日历”。",
          path: ["赛程页面", "添加到日历"],
          result: "浏览器询问是否打开“日历”。",
        },
        {
          title: "允许浏览器打开日历",
          body: "确认浏览器提示。“日历”打开后，sports-calendar.com 的订阅地址已经自动填好。",
          path: ["浏览器提示", "打开日历"],
          result: "系统显示“新建日历订阅”窗口。",
        },
        {
          title: "开始订阅",
          body: "检查网址，然后点击“订阅”。如果需要手动填写，请使用网站复制出来的 HTTPS 订阅地址。",
          path: ["新建日历订阅", "订阅"],
          result: "系统显示订阅设置。",
        },
        {
          title: "设置位置和刷新频率",
          body: "填写清晰的日历名称并选择颜色。如果希望同步到其他 Apple 设备，请将位置设为 iCloud；然后选择自动刷新频率并点击“好”。",
          path: ["名称与颜色", "位置与自动刷新", "好"],
          result: "赛程保存完成，并会按设置自动刷新。",
        },
        {
          title: "检查订阅结果",
          body: "在侧边栏找到新日历，打开任意比赛，检查时间、场地和备注。",
          path: ["日历列表", "已订阅的日历", "比赛"],
          result: "实时赛程已经可以使用。",
        },
      ],
      notes: [
        "手动操作路径：在“日历”中选择“文件 → 新建日历订阅”，然后粘贴复制的订阅地址。",
        "如果还要在 iPhone 或 iPad 上查看，请选择 iCloud，而不是“在我的 Mac 上”。",
      ],
      source: {
        label: "Apple 支持：在 Mac 上订阅日历",
        href: "https://support.apple.com/zh-cn/guide/calendar/icl1022/mac",
      },
    },
    {
      slug: "how-to-subscribe-google-calendar",
      accent: "google",
      service: "Google 日历",
      device: "电脑，然后在 Android 或 iPhone 查看",
      title: "在 Google 日历中订阅赛程",
      description: "通过网址将赛程添加到 Google 日历，然后在 Google 日历手机 App 中查看。",
      intro: "Google 只允许在电脑浏览器中添加新的网址订阅。先在网页版完成一次添加，之后使用同一 Google 账户的 Android、iPhone 和 iPad 都会显示这个日历。",
      duration: "约 2 分钟",
      linkType: "复制 HTTPS 订阅链接",
      availability: "电脑添加，手机查看",
      prerequisites: [
        "请使用台式机或笔记本浏览器；Google 日历手机 App 不能通过网址添加新日历。",
        "登录你在手机 Google 日历 App 中使用的同一个 Google 账户。",
      ],
      steps: [
        {
          title: "复制赛程订阅链接",
          body: "打开要关注的赛事、赛季或球队页面，选择“复制订阅链接”。Google 日历需要复制 HTTPS 地址，不要直接打开 webcal 链接。",
          path: ["赛程页面", "复制订阅链接"],
          result: "实时 .ics 地址已经复制到剪贴板。",
        },
        {
          title: "在电脑上打开 Google 日历",
          body: "使用桌面浏览器进入 calendar.google.com，并确认右上角显示的是正确 Google 账户。",
          path: ["calendar.google.com", "确认 Google 账户"],
          result: "Google 日历主界面打开。",
        },
        {
          title: "选择“通过网址添加”",
          body: "在左侧找到“其他日历”，点击旁边的添加按钮（＋），然后选择“通过网址添加”。",
          path: ["其他日历", "＋", "通过网址添加"],
          result: "页面显示日历网址输入框。",
        },
        {
          title: "粘贴地址并添加",
          body: "粘贴刚才复制的 HTTPS 订阅地址，然后点击“添加日历”。不要下载并导入 .ics 文件；导入只会创建静态副本，无法持续接收赛程变化。",
          path: ["日历网址", "添加日历"],
          result: "赛程出现在“其他日历”下面。",
        },
        {
          title: "在手机上检查",
          body: "使用同一账户打开 Google 日历 App。如果赛程被隐藏，请打开 App 菜单并启用刚添加的日历。",
          path: ["Google 日历 App", "菜单", "启用日历"],
          result: "Android、iPhone 或 iPad 上已经显示订阅的比赛。",
        },
      ],
      notes: [
        "Google 日历的 Android、iPhone 和 iPad App 都不能添加网址订阅；首次设置必须使用电脑浏览器。",
        "Google 决定订阅日历的刷新频率，因此数据源变化后可能不会立即显示。",
      ],
      source: {
        label: "Google 日历帮助：使用链接添加公开日历",
        href: "https://support.google.com/calendar/answer/37100?co=GENIE.Platform%3DDesktop&hl=zh-Hans",
      },
    },
    {
      slug: "how-to-subscribe-outlook",
      accent: "outlook",
      service: "Outlook 日历",
      device: "Outlook 网页版",
      title: "在 Outlook 日历中订阅赛程",
      description: "在 Outlook 网页版中订阅实时赛程，并持续接收比赛调整。",
      intro: "请使用 Outlook 日历的“从 Web 订阅”。它会创建持续更新的订阅；上传 .ics 文件只会导入一个静态副本，不适合可能调整的体育赛程。",
      duration: "约 2 分钟",
      linkType: "复制 HTTPS 订阅链接",
      availability: "在 Outlook 网页版添加",
      prerequisites: [
        "在桌面浏览器中登录 Outlook.com 或单位提供的 Outlook 网页版。",
        "使用你在其他设备的 Outlook 中登录的同一个 Microsoft 账户。",
      ],
      steps: [
        {
          title: "复制赛程订阅链接",
          body: "打开要关注的赛事、赛季或球队页面，选择“复制订阅链接”。Outlook 需要 HTTPS 日历地址。",
          path: ["赛程页面", "复制订阅链接"],
          result: "实时 .ics 地址已经复制到剪贴板。",
        },
        {
          title: "打开 Outlook 日历",
          body: "登录 Outlook.com 或单位的 Outlook 网页版，然后从导航栏打开“日历”。",
          path: ["Outlook 网页版", "日历"],
          result: "Outlook 日历主界面打开。",
        },
        {
          title: "选择“从 Web 订阅”",
          body: "点击“添加日历”，然后选择“从 Web 订阅”。个人账户与工作或学校账户的文字可能略有不同。",
          path: ["添加日历", "从 Web 订阅"],
          result: "Outlook 显示订阅地址输入框。",
        },
        {
          title: "粘贴并保存",
          body: "粘贴复制的 HTTPS 地址，按需设置容易识别的名称和颜色，然后点击“导入”或“保存”。",
          path: ["日历 URL", "名称与颜色", "导入 / 保存"],
          result: "赛程被添加为订阅日历。",
        },
        {
          title: "检查订阅结果",
          body: "在侧边栏找到新日历并打开任意比赛。使用同一账户登录的 Outlook App 也会显示这个日历。",
          path: ["日历列表", "已订阅的日历", "比赛"],
          result: "实时赛程已经可以使用，并能接收后续更新。",
        },
      ],
      notes: [
        "务必选择“从 Web 订阅”。“从文件上传”只是一次性导入，不能自动接收赛程变化。",
        "Microsoft 提示，订阅日历的更新有时可能需要超过 24 小时才会显示。",
      ],
      source: {
        label: "Microsoft 支持：在 Outlook 中导入或订阅日历",
        href: "https://support.microsoft.com/zh-cn/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web",
      },
    },
  ],
};

const indexCopy: Record<Locale, TutorialIndexCopy> = {
  en: {
    eyebrow: "Calendar subscription guides",
    title: "Choose the calendar you actually use",
    description: "Every guide creates a live calendar subscription, so match times, postponements, and venue changes can update without importing the schedule again.",
    chooseTitle: "Subscription guide matrix",
    chooseBody: "Start with your calendar service, not your phone model. Google Calendar and Outlook subscriptions are added to the account on the web, then sync to their mobile apps.",
    importantTitle: "Using Google Calendar on Android?",
    importantBody: "Complete the Google Calendar guide once in a computer browser. Google does not allow a new URL subscription inside its Android, iPhone, or iPad app.",
    openGuideLabel: "Open guide",
    durationLabel: "Time",
    linkTypeLabel: "Method",
    availabilityLabel: "Where",
    principlesTitle: "Before you start",
    principles: [
      {
        title: "Subscribe instead of importing",
        body: "A subscription remains connected to the schedule. Importing an .ics file usually creates a fixed snapshot that does not receive future changes.",
      },
      {
        title: "Use the right link",
        body: "Apple Calendar can open the Add to Calendar link directly. Google Calendar and Outlook should use the HTTPS address from Copy subscription link.",
      },
      {
        title: "Expect provider refresh delays",
        body: "sports-calendar.com publishes changes to the feed, but Apple, Google, and Microsoft decide when their calendar apps fetch the next update.",
      },
    ],
  },
  zh: {
    eyebrow: "日历订阅教程",
    title: "选择你真正使用的日历",
    description: "每篇教程都会创建持续更新的日历订阅。比赛时间、延期和场地发生变化时，不需要重新导入整份赛程。",
    chooseTitle: "订阅教程矩阵",
    chooseBody: "请先选择日历服务，而不是手机型号。Google 日历和 Outlook 需要先在网页端添加到账户，再同步到手机 App。",
    importantTitle: "在 Android 上使用 Google 日历？",
    importantBody: "请先用电脑浏览器完成一次 Google 日历教程。Google 不允许在 Android、iPhone 或 iPad App 中直接添加新的网址订阅。",
    openGuideLabel: "查看教程",
    durationLabel: "耗时",
    linkTypeLabel: "方式",
    availabilityLabel: "完成位置",
    principlesTitle: "开始前请注意",
    principles: [
      {
        title: "订阅，不要导入",
        body: "订阅会持续连接赛程数据源；导入 .ics 文件通常只会创建一个静态副本，之后无法自动接收变化。",
      },
      {
        title: "选择正确的链接",
        body: "Apple 日历可以直接打开“添加到日历”；Google 日历和 Outlook 应使用“复制订阅链接”提供的 HTTPS 地址。",
      },
      {
        title: "日历服务可能延迟刷新",
        body: "sports-calendar.com 会及时更新订阅源，但 Apple、Google 和 Microsoft 会自行决定日历 App 下一次获取更新的时间。",
      },
    ],
  },
};

export function getTutorials(locale: Locale) {
  return tutorials[locale];
}

export function getTutorial(locale: Locale, slug: string): TutorialDocument | null {
  return tutorials[locale].find((tutorial) => tutorial.slug === slug) ?? null;
}

export function getTutorialSlugs() {
  return tutorials.en.map((tutorial) => tutorial.slug);
}

export function getTutorialIndexCopy(locale: Locale) {
  return indexCopy[locale];
}

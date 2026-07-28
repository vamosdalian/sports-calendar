package domain

// ICSAnalyticsOverview is the admin-facing summary of ICS feed consumption.
type ICSAnalyticsOverview struct {
	GeneratedAt string                    `json:"generatedAt"`
	Totals      ICSAnalyticsTotals        `json:"totals"`
	Trend       []ICSAnalyticsTrendPoint  `json:"trend"`
	Feeds       []ICSAnalyticsFeedRow     `json:"feeds"`
	Clients     []ICSAnalyticsClientRow   `json:"clients"`
}

// ICSAnalyticsTotals holds the headline numbers.
//
// A "subscriber" is a distinct calendar client that pulled a feed in the
// window. Browser hits and crawlers are excluded, so these are live
// subscriptions rather than traffic.
type ICSAnalyticsTotals struct {
	SubscribersToday int64 `json:"subscribersToday"`
	Subscribers7d    int64 `json:"subscribers7d"`
	Subscribers30d   int64 `json:"subscribers30d"`
	FetchesToday     int64 `json:"fetchesToday"`
	Fetches7d        int64 `json:"fetches7d"`
}

// ICSAnalyticsTrendPoint is one day of the subscription trend.
type ICSAnalyticsTrendPoint struct {
	Day         string `json:"day"`
	Subscribers int64  `json:"subscribers"`
	Fetches     int64  `json:"fetches"`
}

// ICSAnalyticsFeedRow ranks a single feed by active subscribers.
type ICSAnalyticsFeedRow struct {
	SportSlug   string `json:"sportSlug"`
	LeagueSlug  string `json:"leagueSlug"`
	SeasonSlug  string `json:"seasonSlug"`
	TeamSlug    string `json:"teamSlug"`
	Subscribers int64  `json:"subscribers"`
	Fetches     int64  `json:"fetches"`
}

// ICSAnalyticsClientRow breaks subscribers down by calendar application,
// which is what decides which subscribe tutorial to write next.
type ICSAnalyticsClientRow struct {
	Client      string `json:"client"`
	Subscribers int64  `json:"subscribers"`
	Fetches     int64  `json:"fetches"`
}

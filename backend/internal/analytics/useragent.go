// Package analytics records how ICS feeds are actually consumed.
//
// Calendar clients poll a subscribed feed on their own schedule, so the fetch
// log — not page views — is the only honest measure of how many live
// subscriptions a feed has. Classifying the client also tells us which
// subscribe tutorial is worth writing next.
package analytics

import "strings"

// Client buckets a fetch by the calendar application that made it.
const (
	ClientIOS         = "ios"
	ClientMacOS       = "macos"
	ClientGoogle      = "google"
	ClientOutlook     = "outlook"
	ClientThunderbird = "thunderbird"
	ClientDavx5       = "davx5"
	ClientOtherCal    = "other_calendar"
	ClientBrowser     = "browser"
	ClientBot         = "bot"
	ClientUnknown     = "unknown"
)

// calendarSignatures maps a lowercased user-agent fragment to a client bucket.
// Order matters: the list is scanned top to bottom and the first hit wins, so
// specific calendar agents must precede the generic browser and bot checks.
// Several of these deliberately sit above the bot rules — Google's importer
// announces itself as "compatible" and would otherwise be mistaken for a
// crawler.
var calendarSignatures = []struct {
	fragment string
	client   string
}{
	// Outlook comes first: its mobile builds announce themselves as
	// "Outlook-iOS/..." and "Outlook-Android/...", which would otherwise be
	// swallowed by the Apple rules below.
	{"outlook", ClientOutlook},
	{"msoffice", ClientOutlook},
	{"microsoft office", ClientOutlook},
	{"microsoft-webdav", ClientOutlook},

	{"google-calendar-importer", ClientGoogle},
	{"google-calendar", ClientGoogle},

	// Apple. iOS fetches through dataaccessd, macOS through CalendarAgent.
	{"dataaccessd", ClientIOS},
	{"ios/", ClientIOS},
	{"iphone", ClientIOS},
	{"ipad", ClientIOS},
	{"calendaragent", ClientMacOS},
	{"calendarstore", ClientMacOS},
	{"mac os x/", ClientMacOS},
	{"macos/", ClientMacOS},

	{"thunderbird", ClientThunderbird},
	{"lightning", ClientThunderbird},

	// Android has no built-in ICS subscription; these two apps provide it.
	{"icsx5", ClientDavx5},
	{"davx5", ClientDavx5},
	{"davdroid", ClientDavx5},

	// Hosted calendar services that poll feeds server-side.
	{"zoho", ClientOtherCal},
	{"fastmail", ClientOtherCal},
	{"yahoo! calendar", ClientOtherCal},
	{"nextcloud", ClientOtherCal},
	{"radicale", ClientOtherCal},
	{"korganizer", ClientOtherCal},
	{"evolution/", ClientOtherCal},
	{"calcurse", ClientOtherCal},
	// Trailing slash keeps this from matching unrelated substrings such as
	// "Radicale" or "vertical".
	{"ical/", ClientOtherCal},
	{"webcal", ClientOtherCal},
	{"caldav", ClientOtherCal},
}

// botSignatures are checked after calendar clients but before browsers.
var botSignatures = []string{
	"bot", "crawler", "spider", "slurp", "crawl",
	"facebookexternalhit", "embedly", "curl/", "wget/",
	"python-requests", "go-http-client", "okhttp", "postman",
	"headlesschrome", "lighthouse",
}

// browserSignatures identify a human opening the .ics URL directly, which is
// a failed subscription rather than an active one — worth separating out.
var browserSignatures = []string{
	"chrome/", "safari/", "firefox/", "edg/", "opera/", "mozilla/",
}

// ClassifyUserAgent buckets a raw User-Agent header into a client constant.
func ClassifyUserAgent(userAgent string) string {
	ua := strings.ToLower(strings.TrimSpace(userAgent))
	if ua == "" {
		return ClientUnknown
	}

	for _, signature := range calendarSignatures {
		if strings.Contains(ua, signature.fragment) {
			return signature.client
		}
	}
	for _, fragment := range botSignatures {
		if strings.Contains(ua, fragment) {
			return ClientBot
		}
	}
	for _, fragment := range browserSignatures {
		if strings.Contains(ua, fragment) {
			return ClientBrowser
		}
	}
	return ClientUnknown
}

// IsSubscriberClient reports whether a bucket represents a real recurring
// subscription. Bots and one-off browser hits are excluded from subscriber
// counts so the growth numbers cannot be inflated by crawlers.
func IsSubscriberClient(client string) bool {
	switch client {
	case ClientBot, ClientBrowser, ClientUnknown:
		return false
	default:
		return true
	}
}

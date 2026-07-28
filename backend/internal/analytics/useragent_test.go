package analytics

import "testing"

func TestClassifyUserAgent(t *testing.T) {
	// Real user agents observed from calendar clients that subscribe to ICS
	// feeds. The tricky ones are Outlook's mobile builds, which embed "iOS"
	// and "Android", and Google's importer, which claims to be "compatible"
	// like a crawler does.
	cases := []struct {
		name      string
		userAgent string
		want      string
	}{
		{"ios dataaccessd", "iOS/17.5.1 (21F90) dataaccessd/1.0", ClientIOS},
		{"ios older", "iOS/15.1 (19B74) dataaccessd/1.0", ClientIOS},
		{"macos calendaragent", "Mac OS X/10.15.7 (19H2026) CalendarAgent/958.5.1", ClientMacOS},
		{"macos ical", "iCal/4.0.4 (1395.7) x-macos", ClientOtherCal},
		{"google importer", "Mozilla/5.0 (compatible; Google-Calendar-Importer)", ClientGoogle},
		{"outlook desktop", "Microsoft Outlook 16.0.17328", ClientOutlook},
		{"outlook ios", "Outlook-iOS/709.2144270.prod.iphone", ClientOutlook},
		{"outlook android", "Outlook-Android/2.0", ClientOutlook},
		{"thunderbird", "Mozilla/5.0 (X11; Linux x86_64; rv:115.0) Gecko/20100101 Thunderbird/115.3.1", ClientThunderbird},
		{"icsx5", "ICSx5/2.1.5 (okhttp/4.11.0) Android/13", ClientDavx5},
		{"davx5", "DAVx5/4.3.3.2-ose (okhttp/4.11.0)", ClientDavx5},
		{"nextcloud", "Nextcloud Server Crawler", ClientOtherCal},
		{"chrome browser", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", ClientBrowser},
		{"googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", ClientBot},
		{"curl", "curl/8.4.0", ClientBot},
		{"empty", "", ClientUnknown},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := ClassifyUserAgent(testCase.userAgent); got != testCase.want {
				t.Fatalf("ClassifyUserAgent(%q) = %q, want %q", testCase.userAgent, got, testCase.want)
			}
		})
	}
}

func TestIsSubscriberClient(t *testing.T) {
	// Only recurring calendar clients count as subscribers; a crawler or a
	// person opening the .ics URL once must not inflate the growth numbers.
	subscribers := []string{ClientIOS, ClientMacOS, ClientGoogle, ClientOutlook, ClientThunderbird, ClientDavx5, ClientOtherCal}
	for _, client := range subscribers {
		if !IsSubscriberClient(client) {
			t.Errorf("IsSubscriberClient(%q) = false, want true", client)
		}
	}

	for _, client := range []string{ClientBot, ClientBrowser, ClientUnknown} {
		if IsSubscriberClient(client) {
			t.Errorf("IsSubscriberClient(%q) = true, want false", client)
		}
	}
}

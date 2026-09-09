package ics

import (
	"bytes"
	"fmt"
	"strconv"
	"strings"
	"time"

	ical "github.com/emersion/go-ical"
	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

func BuildCalendar(detail CalendarPayload, now time.Time) ([]byte, error) {
	locale := normalizeLocale(detail.Locale)
	calendar := ical.NewCalendar()
	calendar.Props.SetText(ical.PropProductID, fmt.Sprintf("-//sports-calendar//season-feed//%s", strings.ToUpper(locale)))
	calendar.Props.SetText(ical.PropVersion, "2.0")
	calendar.Props.SetText(ical.PropCalendarScale, "GREGORIAN")
	calendar.Props.SetText(ical.PropMethod, "PUBLISH")
	calendarName := buildCalendarName(detail, locale)
	calendar.Props.SetText(ical.PropName, calendarName)
	calendar.Props.SetText("X-WR-CALNAME", calendarName)

	for _, match := range detail.Matches {
		event := ical.NewEvent()
		event.Props.SetText(ical.PropUID, fmt.Sprintf("%s@sports-calendar.com", match.ID))
		event.Props.SetDateTime(ical.PropDateTimeStamp, now)
		lastModified := resolveLastModified(match.UpdatedAt, detail.UpdatedAt, now)
		event.Props.SetDateTime(ical.PropLastModified, lastModified)
		event.Props.Set(buildSequence(lastModified))

		startTime, err := match.StartTime()
		if err != nil {
			return nil, err
		}
		venue := domain.PickLocalized(match.Venue, locale)
		event.Props.SetDateTime(ical.PropDateTimeStart, startTime)
		event.Props.SetDateTime(ical.PropDateTimeEnd, startTime.Add(time.Duration(detail.DefaultMatchDurationMinutes)*time.Minute))
		summary := buildSummary(match, locale)
		event.Props.SetText(ical.PropSummary, summary)
		event.Props.SetText(ical.PropDescription, buildDescription(match, locale, detail.MoreMatchesURL))
		if venue != "" {
			event.Props.SetText(ical.PropLocation, venue)
		}
		event.Props.SetText(ical.PropStatus, normalizeStatus(match.Status))
		if match.Status != "" {
			event.Props.SetText("X-SC-MATCH-STATUS", match.Status)
		}
		event.Props.SetText(ical.PropTransparency, "OPAQUE")

		categories := ical.NewProp(ical.PropCategories)
		categoryValues := []string{detail.SportSlug, detail.LeagueSlug}
		if detail.TeamSlug != "" {
			categoryValues = append(categoryValues, detail.TeamSlug)
		}
		categories.SetTextList(categoryValues)
		event.Props.Set(categories)
		// A match whose kickoff time the source has not published yet sits at
		// local midnight as a placeholder. Keep it on the calendar so the date
		// is visible, but don't ring an alarm for an hour nobody scheduled --
		// that woke subscribers up before a match that wasn't kicking off.
		if !match.KickoffTimeTBD {
			event.Children = append(event.Children, buildReminderAlarm(summary))
		}

		calendar.Children = append(calendar.Children, event.Component)
	}

	var buf bytes.Buffer
	if err := ical.NewEncoder(&buf).Encode(calendar); err != nil {
		return nil, fmt.Errorf("encode calendar: %w", err)
	}
	return buf.Bytes(), nil
}

// BuildExpiredFeedCalendar renders the one-event calendar served when a team
// feed's slug is stale. The event is an all-day entry on the day the feed is
// generated, so it keeps moving to "today" on every refresh and stays visible
// until the subscriber replaces the URL.
func BuildExpiredFeedCalendar(payload ExpiredFeedPayload, now time.Time) ([]byte, error) {
	locale := normalizeLocale(payload.Locale)
	labels := localizedExpiredLabels(locale)
	leagueName := leagueDisplayName(payload.LeagueNames, payload.LeagueSlug, locale)

	return buildNoticeCalendar(noticeSpec{
		locale:       locale,
		calendarName: fmt.Sprintf("%s %s - %s", leagueName, payload.SeasonLabel, labels.CalendarSuffix),
		uid:          fmt.Sprintf("expired-%s-%s-%s@sports-calendar.com", payload.LeagueSlug, payload.SeasonLabel, payload.TeamSlug),
		summary:      labels.Summary,
		description:  buildExpiredDescription(payload, labels),
		url:          payload.ResubscribeURL,
		categories:   []string{payload.SportSlug, payload.LeagueSlug, payload.TeamSlug},
	}, now)
}

// BuildRetiredFeedCalendar renders the notice served for a league that has been
// taken down. A retired league's feed used to 404, which a calendar client
// treats as a transient error: it keeps the fixtures it already has and retries
// forever, so the subscriber sees a calendar that simply stopped updating and
// never learns why. This replaces the fixtures with a single dated notice --
// which also clears the retired league's matches out of their calendar, since
// a feed is an authoritative snapshot and anything absent from it is deleted.
func BuildRetiredFeedCalendar(payload RetiredFeedPayload, now time.Time) ([]byte, error) {
	locale := normalizeLocale(payload.Locale)
	labels := localizedRetiredLabels(locale)
	leagueName := leagueDisplayName(payload.LeagueNames, payload.LeagueSlug, locale)

	lines := []string{fmt.Sprintf(labels.Reason, leagueName), "", labels.HowToFix}
	if payload.BrowseURL != "" {
		lines = append(lines, "", payload.BrowseURL)
	}

	return buildNoticeCalendar(noticeSpec{
		locale:       locale,
		calendarName: fmt.Sprintf("%s - %s", leagueName, labels.CalendarSuffix),
		uid:          fmt.Sprintf("retired-%s@sports-calendar.com", payload.LeagueSlug),
		summary:      fmt.Sprintf(labels.Summary, leagueName),
		description:  strings.Join(lines, "\n"),
		url:          payload.BrowseURL,
		categories:   []string{payload.SportSlug, payload.LeagueSlug},
	}, now)
}

func leagueDisplayName(names domain.LocalizedText, slug, locale string) string {
	if name := domain.PickLocalized(names, locale); name != "" {
		return name
	}
	return slug
}

// noticeSpec is one all-day notice event standing in for a feed's fixtures.
type noticeSpec struct {
	locale       string
	calendarName string
	uid          string
	summary      string
	description  string
	url          string
	categories   []string
}

// buildNoticeCalendar renders a one-event calendar. The event is an all-day
// entry on the day the feed is generated, so it keeps moving to "today" on
// every refresh and stays visible until the subscriber acts on it.
func buildNoticeCalendar(spec noticeSpec, now time.Time) ([]byte, error) {
	calendar := ical.NewCalendar()
	calendar.Props.SetText(ical.PropProductID, fmt.Sprintf("-//sports-calendar//season-feed//%s", strings.ToUpper(spec.locale)))
	calendar.Props.SetText(ical.PropVersion, "2.0")
	calendar.Props.SetText(ical.PropCalendarScale, "GREGORIAN")
	calendar.Props.SetText(ical.PropMethod, "PUBLISH")
	calendar.Props.SetText(ical.PropName, spec.calendarName)
	calendar.Props.SetText("X-WR-CALNAME", spec.calendarName)

	day := now.UTC().Truncate(24 * time.Hour)
	event := ical.NewEvent()
	event.Props.SetText(ical.PropUID, spec.uid)
	event.Props.SetDateTime(ical.PropDateTimeStamp, now)
	event.Props.SetDateTime(ical.PropLastModified, now)
	event.Props.Set(buildSequence(now))
	event.Props.SetDate(ical.PropDateTimeStart, day)
	event.Props.SetDate(ical.PropDateTimeEnd, day.AddDate(0, 0, 1))
	event.Props.SetText(ical.PropSummary, spec.summary)
	event.Props.SetText(ical.PropDescription, spec.description)
	if spec.url != "" {
		// SetText would stamp VALUE=TEXT on a property clients expect as a URI,
		// which is what makes the link tappable in the event detail view.
		urlProp := ical.NewProp(ical.PropURL)
		urlProp.Value = spec.url
		event.Props.Set(urlProp)
	}
	event.Props.SetText(ical.PropStatus, "CONFIRMED")
	// TRANSPARENT so the notice never makes the subscriber look busy all day.
	event.Props.SetText(ical.PropTransparency, "TRANSPARENT")

	categories := ical.NewProp(ical.PropCategories)
	categories.SetTextList(spec.categories)
	event.Props.Set(categories)

	calendar.Children = append(calendar.Children, event.Component)

	var buf bytes.Buffer
	if err := ical.NewEncoder(&buf).Encode(calendar); err != nil {
		return nil, fmt.Errorf("encode notice calendar: %w", err)
	}
	return buf.Bytes(), nil
}

type expiredLabels struct {
	CalendarSuffix string
	Summary        string
	Reason         string
	HowToFix       string
}

func localizedExpiredLabels(locale string) expiredLabels {
	if locale == "zh" {
		return expiredLabels{
			CalendarSuffix: "订阅已过期",
			Summary:        "⚠️ 订阅已过期，请重新订阅",
			Reason:         "原因：数据源更新后，球队标识 %q 已不再对应该赛季的任何球队，这个订阅链接已失效，不会再更新赛程。",
			HowToFix:       "解决办法：删除当前订阅，然后打开下面的页面，重新选择球队并订阅。",
		}
	}
	return expiredLabels{
		CalendarSuffix: "Subscription expired",
		Summary:        "⚠️ Subscription expired — please re-subscribe",
		Reason:         "Why: after a data source update, the team id %q no longer matches any team in this season, so this subscription URL is dead and will never receive fixtures again.",
		HowToFix:       "How to fix: remove this subscription, then open the page below to pick the team and subscribe again.",
	}
}

type retiredLabels struct {
	CalendarSuffix string
	Summary        string
	Reason         string
	HowToFix       string
}

func localizedRetiredLabels(locale string) retiredLabels {
	if locale == "zh" {
		return retiredLabels{
			CalendarSuffix: "赛事已下线",
			// No space after %s: the league name runs straight into the
			// Chinese text. The English template needs one, Chinese does not.
			Summary:  "⚠️ %s日历已停止更新",
			Reason:   "原因：%s已经结束，并且不再由 sports-calendar 提供赛程，这个订阅不会再有新的比赛。原有的比赛也已从这个日历中移除。",
			HowToFix: "解决办法：在日历应用里删除这个订阅。仍在更新的赛事可以在下面的页面找到。",
		}
	}
	return retiredLabels{
		CalendarSuffix: "Calendar retired",
		Summary:        "⚠️ %s calendar is no longer updated",
		Reason:         "Why: %s has finished and is no longer covered by sports-calendar, so this subscription will never receive another fixture. Its previous matches have been removed from this calendar too.",
		HowToFix:       "How to fix: remove this subscription from your calendar app. Competitions still being updated are listed on the page below.",
	}
}

func buildExpiredDescription(payload ExpiredFeedPayload, labels expiredLabels) string {
	lines := []string{
		fmt.Sprintf(labels.Reason, payload.TeamSlug),
		"",
		labels.HowToFix,
	}
	if payload.ResubscribeURL != "" {
		lines = append(lines, "", payload.ResubscribeURL)
	}
	return strings.Join(lines, "\n")
}

func resolveLastModified(matchUpdatedAt, feedUpdatedAt string, fallback time.Time) time.Time {
	for _, value := range []string{matchUpdatedAt, feedUpdatedAt} {
		if value == "" {
			continue
		}
		parsed, err := time.Parse(time.RFC3339, value)
		if err == nil {
			return parsed.UTC()
		}
	}
	return fallback.UTC()
}

func buildSequence(lastModified time.Time) *ical.Prop {
	sequence := ical.NewProp(ical.PropSequence)
	sequence.SetValueType(ical.ValueInt)
	sequence.Value = strconv.FormatInt(lastModified.Unix(), 10)
	return sequence
}

func buildReminderAlarm(summary string) *ical.Component {
	alarm := ical.NewComponent(ical.CompAlarm)
	alarm.Props.SetText(ical.PropAction, "DISPLAY")
	trigger := ical.NewProp(ical.PropTrigger)
	trigger.SetDuration(-30 * time.Minute)
	alarm.Props.Set(trigger)
	alarm.Props.SetText(ical.PropDescription, summary)
	return alarm
}

func buildSummary(match domain.Match, locale string) string {
	if match.Status == "finished" && len(match.Result) == 2 && match.HomeTeam != nil && match.AwayTeam != nil {
		homeName := domain.PickLocalized(match.HomeTeam.Names, locale)
		awayName := domain.PickLocalized(match.AwayTeam.Names, locale)
		if homeName != "" && awayName != "" {
			return fmt.Sprintf("%s %s:%s %s", homeName, match.Result[0], match.Result[1], awayName)
		}
	}
	return match.DisplayTitle(locale)
}

func buildDescription(match domain.Match, locale, moreMatchesURL string) string {
	labels := localizedDescriptionLabels(locale)
	lines := []string{
		fmt.Sprintf("%s: %s", labels.Round, domain.PickLocalized(match.Round, locale)),
		fmt.Sprintf("%s: %s", labels.Teams, buildTeamsLine(match, locale)),
	}
	if score := buildScoreLine(match); score != "" {
		lines = append(lines, fmt.Sprintf("%s: %s", labels.Score, score))
	}
	lines = append(lines,
		fmt.Sprintf("%s: %s", labels.Status, localizeMatchStatus(match.Status, locale)),
		fmt.Sprintf("%s: %s", labels.Venue, buildLocation(
			domain.PickLocalized(match.Venue, locale),
			domain.PickLocalized(match.City, locale),
			domain.PickLocalized(match.Country, locale),
		)),
	)
	if moreMatchesURL != "" {
		lines = append(lines, "", fmt.Sprintf("%s: %s", labels.MoreMatches, moreMatchesURL))
	}
	return strings.Join(lines, "\n")
}

func normalizeStatus(status string) string {
	switch status {
	case "finished":
		return "CONFIRMED"
	case "cancelled":
		return "CANCELLED"
	case "postponed":
		return "TENTATIVE"
	default:
		return "CONFIRMED"
	}
}

func buildCalendarName(detail CalendarPayload, locale string) string {
	leagueName := domain.PickLocalized(detail.LeagueNames, locale)
	if leagueName == "" {
		leagueName = detail.LeagueSlug
	}
	if detail.TeamSlug == "" {
		return fmt.Sprintf("%s %s", leagueName, detail.SeasonLabel)
	}

	teamName := domain.PickLocalized(detail.TeamNames, locale)
	if teamName == "" {
		teamName = detail.TeamSlug
	}

	return fmt.Sprintf("%s %s - %s", leagueName, detail.SeasonLabel, teamName)
}

func buildLocation(parts ...string) string {
	filtered := make([]string, 0, len(parts))
	for _, part := range parts {
		if part == "" {
			continue
		}
		filtered = append(filtered, part)
	}
	if len(filtered) == 0 {
		return ""
	}
	return fmt.Sprintf("%s", filtered[0]) + joinLocationSuffix(filtered[1:])
}

func joinLocationSuffix(parts []string) string {
	if len(parts) == 0 {
		return ""
	}
	return ", " + fmt.Sprintf("%s", parts[0]) + joinLocationSuffix(parts[1:])
}

type descriptionLabels struct {
	Round       string
	Teams       string
	Score       string
	Status      string
	Venue       string
	MoreMatches string
}

func localizedDescriptionLabels(locale string) descriptionLabels {
	switch normalizeLocale(locale) {
	case "zh":
		return descriptionLabels{
			Round:       "轮次",
			Teams:       "球队",
			Score:       "比分",
			Status:      "状态",
			Venue:       "场地",
			MoreMatches: "更多比赛",
		}
	default:
		return descriptionLabels{
			Round:       "Round",
			Teams:       "Teams",
			Score:       "Score",
			Status:      "Status",
			Venue:       "Venue",
			MoreMatches: "More matches",
		}
	}
}

func buildTeamsLine(match domain.Match, locale string) string {
	if match.HomeTeam == nil || match.AwayTeam == nil {
		return ""
	}
	homeName := domain.PickLocalized(match.HomeTeam.Names, locale)
	awayName := domain.PickLocalized(match.AwayTeam.Names, locale)
	if homeName == "" || awayName == "" {
		return ""
	}
	return fmt.Sprintf("%s vs %s", homeName, awayName)
}

func buildScoreLine(match domain.Match) string {
	if match.Status != "finished" || len(match.Result) != 2 {
		return ""
	}
	return fmt.Sprintf("%s:%s", match.Result[0], match.Result[1])
}

func localizeMatchStatus(status, locale string) string {
	switch normalizeLocale(locale) {
	case "zh":
		switch status {
		case "scheduled":
			return "已安排"
		case "finished":
			return "已结束"
		case "cancelled":
			return "已取消"
		case "postponed":
			return "已延期"
		default:
			return status
		}
	default:
		switch status {
		case "scheduled":
			return "Scheduled"
		case "finished":
			return "Finished"
		case "cancelled":
			return "Cancelled"
		case "postponed":
			return "Postponed"
		default:
			return status
		}
	}
}

func normalizeLocale(locale string) string {
	if locale == "zh" {
		return "zh"
	}
	return "en"
}

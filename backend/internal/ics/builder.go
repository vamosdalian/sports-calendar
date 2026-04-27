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
		event.Props.SetText(ical.PropDescription, buildDescription(match, locale))
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
		event.Children = append(event.Children, buildReminderAlarm(summary))

		calendar.Children = append(calendar.Children, event.Component)
	}

	var buf bytes.Buffer
	if err := ical.NewEncoder(&buf).Encode(calendar); err != nil {
		return nil, fmt.Errorf("encode calendar: %w", err)
	}
	return buf.Bytes(), nil
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

func buildDescription(match domain.Match, locale string) string {
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
	Round  string
	Teams  string
	Score  string
	Status string
	Venue  string
}

func localizedDescriptionLabels(locale string) descriptionLabels {
	switch normalizeLocale(locale) {
	case "zh":
		return descriptionLabels{
			Round:  "轮次",
			Teams:  "球队",
			Score:  "比分",
			Status: "状态",
			Venue:  "场地",
		}
	default:
		return descriptionLabels{
			Round:  "Round",
			Teams:  "Teams",
			Score:  "Score",
			Status: "Status",
			Venue:  "Venue",
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

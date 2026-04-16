package ics

import (
	"bytes"
	"fmt"
	"time"

	ical "github.com/emersion/go-ical"
	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

func BuildCalendar(detail CalendarPayload, now time.Time) ([]byte, error) {
	locale := normalizeLocale(detail.Locale)
	calendar := ical.NewCalendar()
	calendar.Props.SetText(ical.PropProductID, "-//sports-calendar//season-feed//EN")
	calendar.Props.SetText(ical.PropVersion, "2.0")
	calendar.Props.SetText(ical.PropName, buildCalendarName(detail, locale))

	for _, match := range detail.Matches {
		event := ical.NewEvent()
		event.Props.SetText(ical.PropUID, fmt.Sprintf("%s@sports-calendar.com", match.ID))
		event.Props.SetDateTime(ical.PropDateTimeStamp, now)

		startTime, err := match.StartTime()
		if err != nil {
			return nil, err
		}
		venue := domain.PickLocalized(match.Venue, locale)
		city := domain.PickLocalized(match.City, locale)
		event.Props.SetDateTime(ical.PropDateTimeStart, startTime)
		event.Props.SetDateTime(ical.PropDateTimeEnd, startTime.Add(time.Duration(detail.DefaultMatchDurationMinutes)*time.Minute))
		event.Props.SetText(ical.PropSummary, match.DisplayTitle(locale))
		event.Props.SetText(ical.PropDescription, buildDescription(match, locale))
		if location := buildLocation(venue, city); location != "" {
			event.Props.SetText(ical.PropLocation, location)
		}
		event.Props.SetText(ical.PropStatus, normalizeStatus(match.Status))

		categories := ical.NewProp(ical.PropCategories)
		categoryValues := []string{detail.SportSlug, detail.LeagueSlug}
		if detail.TeamSlug != "" {
			categoryValues = append(categoryValues, detail.TeamSlug)
		}
		categories.SetTextList(categoryValues)
		event.Props.Set(categories)

		calendar.Children = append(calendar.Children, event.Component)
	}

	var buf bytes.Buffer
	if err := ical.NewEncoder(&buf).Encode(calendar); err != nil {
		return nil, fmt.Errorf("encode calendar: %w", err)
	}
	return buf.Bytes(), nil
}

func buildDescription(match domain.Match, locale string) string {
	labels := localizedDescriptionLabels(locale)
	return fmt.Sprintf(
		"%s: %s\n%s: %s\n%s: %s\n%s: %s",
		labels.Round,
		domain.PickLocalized(match.Round, locale),
		labels.Status,
		localizeMatchStatus(match.Status, locale),
		labels.Venue,
		domain.PickLocalized(match.Venue, locale),
		labels.City,
		domain.PickLocalized(match.City, locale),
	)
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
	Status string
	Venue  string
	City   string
}

func localizedDescriptionLabels(locale string) descriptionLabels {
	switch normalizeLocale(locale) {
	case "zh":
		return descriptionLabels{
			Round:  "轮次",
			Status: "状态",
			Venue:  "场地",
			City:   "城市",
		}
	default:
		return descriptionLabels{
			Round:  "Round",
			Status: "Status",
			Venue:  "Venue",
			City:   "City",
		}
	}
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

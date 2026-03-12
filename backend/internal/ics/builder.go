package ics

import (
	"bytes"
	"fmt"
	"net/url"
	"time"

	ical "github.com/emersion/go-ical"
	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

func BuildCalendar(detail CalendarPayload, now time.Time) ([]byte, error) {
	calendar := ical.NewCalendar()
	calendar.Props.SetText(ical.PropProductID, "-//sports-calendar//season-feed//EN")
	calendar.Props.SetText(ical.PropVersion, "2.0")
	calendar.Props.SetText(ical.PropName, fmt.Sprintf("%s %s", domain.PickLocalized(detail.LeagueNames, "en"), detail.SeasonLabel))

	for _, match := range detail.Matches {
		event := ical.NewEvent()
		event.Props.SetText(ical.PropUID, fmt.Sprintf("%s@sports-calendar.com", match.ID))
		event.Props.SetDateTime(ical.PropDateTimeStamp, now)

		startTime, err := match.StartTime()
		if err != nil {
			return nil, err
		}
		event.Props.SetDateTime(ical.PropDateTimeStart, startTime)
		event.Props.SetDateTime(ical.PropDateTimeEnd, startTime.Add(time.Duration(detail.DefaultMatchDurationMinutes)*time.Minute))
		event.Props.SetText(ical.PropSummary, match.DisplayTitle("en"))
		event.Props.SetText(ical.PropDescription, buildDescription(match))
		event.Props.SetText(ical.PropLocation, fmt.Sprintf("%s, %s", match.Venue, match.City))
		event.Props.SetText(ical.PropStatus, normalizeStatus(match.Status))

		categories := ical.NewProp(ical.PropCategories)
		categories.SetTextList([]string{detail.SportSlug, detail.LeagueSlug})
		event.Props.Set(categories)

		if match.Ticket != nil && match.Ticket.URL != "" {
			parsedURL, err := url.Parse(match.Ticket.URL)
			if err == nil {
				event.Props.SetURI(ical.PropURL, parsedURL)
			}
		}

		calendar.Children = append(calendar.Children, event.Component)
	}

	var buf bytes.Buffer
	if err := ical.NewEncoder(&buf).Encode(calendar); err != nil {
		return nil, fmt.Errorf("encode calendar: %w", err)
	}
	return buf.Bytes(), nil
}

func buildDescription(match domain.Match) string {
	description := fmt.Sprintf("Round: %s\nStatus: %s\nVenue: %s\nCity: %s", match.Round, match.Status, match.Venue, match.City)
	if match.Ticket != nil {
		description += fmt.Sprintf("\nTicket URL: %s", match.Ticket.URL)
		if match.Ticket.OpenAt != "" {
			description += fmt.Sprintf("\nTicket opens: %s", match.Ticket.OpenAt)
		}
	}
	return description
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

package domain

import "time"

type LeagueSyncTarget struct {
	LeagueID     int64
	LeagueSlug   string
	SyncInterval string
	SeasonID     int64
	SeasonSlug   string
	SeasonLabel  string
}

type LeagueSnapshot struct {
	Target              LeagueSyncTarget
	LeagueNames         LocalizedText
	CalendarDescription LocalizedText
	DataSourceNote      LocalizedText
	Teams               []TeamSyncRecord
	Matches             []MatchSyncRecord
}

type TeamSyncRecord struct {
	ID        int64
	Slug      string
	Names     LocalizedText
	ShortName LocalizedText
}

type MatchSyncRecord struct {
	ExternalID string
	Teams      []int64
	Round      LocalizedText
	Venue      LocalizedText
	City       LocalizedText
	Country    LocalizedText
	StartsAt   time.Time
	Status     string
}

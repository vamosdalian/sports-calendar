package domain

import "time"

type RefreshRequestSource string

const (
	RefreshRequestSourceManual RefreshRequestSource = "manual"
	RefreshRequestSourceCron   RefreshRequestSource = "cron"
)

type RefreshEnqueueStatus string

const (
	RefreshEnqueueStatusQueued         RefreshEnqueueStatus = "queued"
	RefreshEnqueueStatusAlreadyQueued  RefreshEnqueueStatus = "already_queued"
	RefreshEnqueueStatusAlreadyRunning RefreshEnqueueStatus = "already_running"
)

type RefreshTaskStatus string

const (
	RefreshTaskStatusRunning   RefreshTaskStatus = "running"
	RefreshTaskStatusSucceeded RefreshTaskStatus = "succeeded"
	RefreshTaskStatusFailed    RefreshTaskStatus = "failed"
)

type LeagueSyncTarget struct {
	LeagueID     int64
	LeagueSlug   string
	SyncInterval string
	SeasonID     int64
	SeasonSlug   string
	SeasonLabel  string
	// Provider is the sync source. "spider" is fetched automatically; "manual"
	// is retained without polling.
	Provider string
	// ExternalRef is the provider-native league key. For the spider it is the
	// Transfermarkt competition code (e.g. "CSL", "CSL@-1").
	ExternalRef string
	// SeasonStartYear is the Transfermarkt saison_id the spider expects.
	SeasonStartYear int
}

type RefreshTask struct {
	LeagueID    int64                `json:"leagueId"`
	LeagueSlug  string               `json:"leagueSlug"`
	SeasonID    int64                `json:"seasonId"`
	SeasonSlug  string               `json:"seasonSlug"`
	RequestedAt string               `json:"requestedAt"`
	Source      RefreshRequestSource `json:"source"`
}

type RunningRefreshTask struct {
	RefreshTask
	StartedAt string            `json:"startedAt"`
	Status    RefreshTaskStatus `json:"status"`
}

type RecentRefreshTask struct {
	RefreshTask
	StartedAt  string            `json:"startedAt"`
	FinishedAt string            `json:"finishedAt"`
	Status     RefreshTaskStatus `json:"status"`
	Error      string            `json:"error,omitempty"`
}

type RefreshQueueStats struct {
	QueueLength int `json:"queueLength"`
}

type RefreshQueueSnapshot struct {
	Running *RunningRefreshTask `json:"running"`
	Queued  []RefreshTask       `json:"queued"`
	Recent  []RecentRefreshTask `json:"recent"`
	Stats   RefreshQueueStats   `json:"stats"`
}

type RefreshEnqueueResponse struct {
	Status RefreshEnqueueStatus `json:"status"`
}

type LeagueSnapshot struct {
	Target              LeagueSyncTarget
	LeagueNames         LocalizedText
	CalendarDescription LocalizedText
	DataSourceNote      LocalizedText
	Teams               []TeamSyncRecord
	Venues              []VenueSyncRecord
	Matches             []MatchSyncRecord
}

type TeamSyncRecord struct {
	ID        int64
	Slug      string
	Names     LocalizedText
	ShortName LocalizedText
}

// SourceTimeZone is the zone the upstream crawler renders kickoff times in
// (Transfermarkt's German site default). Two places need it and must agree:
// the syncer, which reinterprets the crawler's naive wall-clock time before
// storing UTC, and the read path, which recovers the published match date for
// fixtures whose kickoff time is still pending. Change it in one place only.
const SourceTimeZone = "Europe/Berlin"

type MatchSyncRecord struct {
	ExternalID string
	Teams      []int64
	TeamNames  []LocalizedText
	Round      LocalizedText
	VenueID    *int64
	StartsAt   time.Time
	// KickoffTimeTBD marks a match whose kickoff time the source has not
	// published yet; StartsAt is then local midnight, not a real kickoff.
	KickoffTimeTBD bool
	Status         string
	Result         []string
}

type VenueSyncRecord struct {
	ID      int64
	Name    LocalizedText
	City    LocalizedText
	Country LocalizedText
}

package model

import "time"

// SessionType distinguishes terminal from port-forward sessions.
type SessionType string

const (
	SessionTypeTerminal    SessionType = "terminal"
	SessionTypePortForward SessionType = "port-forward"
)

// SessionStatus tracks the lifecycle of a session.
type SessionStatus string

const (
	SessionStatusActive     SessionStatus = "active"
	SessionStatusTerminated SessionStatus = "terminated"
	SessionStatusFailed     SessionStatus = "failed"
)

// Session represents an SSM session (terminal or port-forward).
type Session struct {
	ID           string        `db:"id" json:"id"`
	ProfileID    string        `db:"profile_id" json:"profileId"`
	ProfileName  string        `db:"profile_name" json:"profileName"`
	InstanceID   string        `db:"instance_id" json:"instanceId"`
	InstanceName string        `db:"instance_name" json:"instanceName"`
	Type         SessionType   `db:"type" json:"type"`
	Status       SessionStatus `db:"status" json:"status"`
	LocalPort    *int          `db:"local_port" json:"localPort,omitempty"`
	RemotePort   *int          `db:"remote_port" json:"remotePort,omitempty"`
	RemoteHost   *string       `db:"remote_host" json:"remoteHost,omitempty"`
	StartedAt    time.Time     `db:"started_at" json:"startedAt"`
	EndedAt      *time.Time    `db:"ended_at" json:"endedAt,omitempty"`
}

// DashboardStats aggregates key metrics for the dashboard.
type DashboardStats struct {
	TotalProfiles  int       `json:"totalProfiles"`
	ActiveSessions int       `json:"activeSessions"`
	TotalSessions  int       `json:"totalSessions"`
	RecentSessions []Session `json:"recentSessions"`
}

package store

import (
	"context"
	"fmt"

	"sesm/internal/model"
)

// StatsStore computes dashboard statistics from profiles and sessions.
type StatsStore struct {
	profiles *ProfileStore
	sessions *SessionStore
}

// NewStatsStore creates a StatsStore.
func NewStatsStore(p *ProfileStore, s *SessionStore) *StatsStore {
	return &StatsStore{profiles: p, sessions: s}
}

// GetDashboardStats returns aggregated metrics for the dashboard.
func (s *StatsStore) GetDashboardStats(ctx context.Context) (*model.DashboardStats, error) {
	profiles, err := s.profiles.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("list profiles: %w", err)
	}

	recent, err := s.sessions.ListRecent(10)
	if err != nil {
		return nil, fmt.Errorf("recent sessions: %w", err)
	}
	if recent == nil {
		recent = []model.Session{}
	}

	return &model.DashboardStats{
		TotalProfiles:  len(profiles),
		RecentSessions: recent,
	}, nil
}

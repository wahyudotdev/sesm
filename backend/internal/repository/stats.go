package repository

import (
	"context"
	"fmt"

	"github.com/jmoiron/sqlx"

	"sesm/internal/model"
)

// StatsRepo computes dashboard aggregate data.
type StatsRepo struct {
	db *sqlx.DB
}

// NewStatsRepo creates a StatsRepo backed by db.
func NewStatsRepo(db *sqlx.DB) *StatsRepo {
	return &StatsRepo{db: db}
}

// GetDashboardStats returns aggregated metrics for the dashboard.
func (r *StatsRepo) GetDashboardStats(ctx context.Context) (*model.DashboardStats, error) {
	var stats model.DashboardStats

	if err := r.db.GetContext(ctx, &stats.TotalProfiles, `SELECT COUNT(*) FROM profiles`); err != nil {
		return nil, fmt.Errorf("count profiles: %w", err)
	}

	if err := r.db.GetContext(ctx, &stats.ActiveSessions, `SELECT COUNT(*) FROM sessions WHERE status = 'active'`); err != nil {
		return nil, fmt.Errorf("count active sessions: %w", err)
	}

	if err := r.db.GetContext(ctx, &stats.TotalSessions, `SELECT COUNT(*) FROM sessions`); err != nil {
		return nil, fmt.Errorf("count total sessions: %w", err)
	}

	err := r.db.SelectContext(ctx, &stats.RecentSessions, `
		SELECT id, profile_id, profile_name, instance_id, instance_name,
		       type, status, local_port, remote_port, remote_host, started_at, ended_at
		FROM sessions
		ORDER BY started_at DESC
		LIMIT 10
	`)
	if err != nil {
		return nil, fmt.Errorf("recent sessions: %w", err)
	}

	if stats.RecentSessions == nil {
		stats.RecentSessions = []model.Session{}
	}

	return &stats, nil
}

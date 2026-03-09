package handler

import (
	"net/http"

	"sesm/internal/store"
)

// StatsHandler groups HTTP handlers for dashboard statistics.
type StatsHandler struct {
	store *store.StatsStore
}

// NewStatsHandler creates a StatsHandler with the given store.
func NewStatsHandler(s *store.StatsStore) *StatsHandler {
	return &StatsHandler{store: s}
}

// GetStats returns dashboard statistics.
func (h *StatsHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.store.GetDashboardStats(r.Context())
	if err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	ok(w, stats)
}

package handler

import (
	"github.com/gofiber/fiber/v2"

	"sesm/internal/repository"
)

// StatsHandler groups HTTP handlers for dashboard statistics.
type StatsHandler struct {
	repo *repository.StatsRepo
}

// NewStatsHandler creates a StatsHandler with the given repo.
func NewStatsHandler(repo *repository.StatsRepo) *StatsHandler {
	return &StatsHandler{repo: repo}
}

// GetStats returns dashboard statistics.
func (h *StatsHandler) GetStats(c *fiber.Ctx) error {
	stats, err := h.repo.GetDashboardStats(c.Context())
	if err != nil {
		return fail(c, fiber.StatusInternalServerError, err.Error())
	}

	return ok(c, stats)
}

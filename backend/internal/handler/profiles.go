package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"sesm/internal/model"
	"sesm/internal/repository"
)

// ProfileHandler groups HTTP handlers for the profiles resource.
type ProfileHandler struct {
	repo *repository.ProfileRepo
}

// NewProfileHandler creates a ProfileHandler with the given repo.
func NewProfileHandler(repo *repository.ProfileRepo) *ProfileHandler {
	return &ProfileHandler{repo: repo}
}

// List returns all configured AWS profiles.
func (h *ProfileHandler) List(c *fiber.Ctx) error {
	profiles, err := h.repo.List(c.Context())
	if err != nil {
		return fail(c, fiber.StatusInternalServerError, err.Error())
	}

	return ok(c, profiles)
}

// Create saves a new AWS profile.
func (h *ProfileHandler) Create(c *fiber.Ctx) error {
	var req model.CreateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return fail(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Name == "" || req.AccessKeyID == "" || req.SecretAccessKey == "" || req.Region == "" {
		return fail(c, fiber.StatusBadRequest, "name, region, accessKeyId and secretAccessKey are required")
	}

	profile, err := h.repo.Create(c.Context(), req)
	if err != nil {
		return fail(c, fiber.StatusInternalServerError, err.Error())
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": profile, "error": nil})
}

// Delete removes a profile by ID.
func (h *ProfileHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return fail(c, fiber.StatusBadRequest, "id is required")
	}

	if err := h.repo.Delete(c.Context(), id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return fail(c, fiber.StatusNotFound, "profile not found")
		}

		return fail(c, fiber.StatusInternalServerError, err.Error())
	}

	return ok(c, nil)
}

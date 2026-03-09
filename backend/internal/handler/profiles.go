package handler

import (
	"encoding/json"
	"net/http"

	"sesm/internal/model"
	"sesm/internal/store"
)

// ProfileHandler groups HTTP handlers for the profiles resource.
type ProfileHandler struct {
	store *store.ProfileStore
}

// NewProfileHandler creates a ProfileHandler with the given store.
func NewProfileHandler(s *store.ProfileStore) *ProfileHandler {
	return &ProfileHandler{store: s}
}

// List returns all configured AWS profiles.
func (h *ProfileHandler) List(w http.ResponseWriter, r *http.Request) {
	profiles, err := h.store.List(r.Context())
	if err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	ok(w, profiles)
}

// Create saves a new AWS profile.
func (h *ProfileHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fail(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.AccessKeyID == "" || req.SecretAccessKey == "" || req.Region == "" {
		fail(w, http.StatusBadRequest, "name, region, accessKeyId and secretAccessKey are required")
		return
	}

	profile, err := h.store.Create(r.Context(), req)
	if err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"data": profile, "error": nil})
}

// Delete removes a profile by ID.
func (h *ProfileHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		fail(w, http.StatusBadRequest, "id is required")
		return
	}

	if err := h.store.Delete(r.Context(), id); err != nil {
		if err.Error() == "not found" {
			fail(w, http.StatusNotFound, "profile not found")
			return
		}
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}

	ok(w, nil)
}

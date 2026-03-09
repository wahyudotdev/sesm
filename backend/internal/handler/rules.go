package handler

import (
	"encoding/json"
	"net/http"

	"sesm/internal/model"
	"sesm/internal/service"
	"sesm/internal/store"
)

// RuleHandler handles port-forwarding rule CRUD.
type RuleHandler struct {
	store *store.RuleStore
	svc   *service.SessionService
}

// NewRuleHandler creates a RuleHandler.
func NewRuleHandler(store *store.RuleStore, svc *service.SessionService) *RuleHandler {
	return &RuleHandler{store: store, svc: svc}
}

// List returns all saved rules.
func (h *RuleHandler) List(w http.ResponseWriter, r *http.Request) {
	rules, err := h.store.List(r.Context())
	if err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	ok(w, rules)
}

// Create saves a new port-forwarding rule.
func (h *RuleHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fail(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.ProfileID == "" || req.InstanceID == "" || req.LocalPort == 0 || req.RemotePort == 0 {
		fail(w, http.StatusBadRequest, "profileId, instanceId, localPort, and remotePort are required")
		return
	}
	rule, err := h.store.Create(r.Context(), req)
	if err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	// If rule is enabled by default, start it immediately.
	if rule.Enabled {
		h.svc.SyncRules(r.Context())
	}
	ok(w, rule)
}

// Toggle enables or disables a rule and immediately starts/stops its session.
func (h *RuleHandler) Toggle(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		fail(w, http.StatusBadRequest, "id is required")
		return
	}

	var body struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		fail(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.store.UpdateEnabled(r.Context(), id, body.Enabled); err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Immediately apply: start or stop the session.
	h.svc.SyncRules(r.Context())

	ok(w, nil)
}

// Delete removes a rule and terminates its session if active.
func (h *RuleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		fail(w, http.StatusBadRequest, "id is required")
		return
	}

	// Disable it first so SyncRules stops the session.
	_ = h.store.UpdateEnabled(r.Context(), id, false)
	h.svc.SyncRules(r.Context())

	if err := h.store.Delete(r.Context(), id); err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}

	ok(w, nil)
}

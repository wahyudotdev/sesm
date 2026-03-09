package handler

import (
	"encoding/json"
	"net/http"

	"sesm/internal/service"
	"sesm/internal/store"
)

// SessionHandler handles session management requests.
type SessionHandler struct {
	svc   *service.SessionService
	store *store.SessionStore
}

// NewSessionHandler creates a SessionHandler.
func NewSessionHandler(svc *service.SessionService, store *store.SessionStore) *SessionHandler {
	return &SessionHandler{svc: svc, store: store}
}

// List returns all sessions.
func (h *SessionHandler) List(w http.ResponseWriter, r *http.Request) {
	sessions, err := h.store.List(r.Context())
	if err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	ok(w, sessions)
}

// StartPortForward initiates a port-forwarding session.
func (h *SessionHandler) StartPortForward(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProfileID    string `json:"profileId"`
		InstanceID   string `json:"instanceId"`
		InstanceName string `json:"instanceName"`
		LocalPort    int    `json:"localPort"`
		RemotePort   int    `json:"remotePort"`
		RemoteHost   string `json:"remoteHost"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fail(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ProfileID == "" || req.InstanceID == "" || req.LocalPort == 0 || req.RemotePort == 0 {
		fail(w, http.StatusBadRequest, "profileId, instanceId, localPort, and remotePort are required")
		return
	}

	id, err := h.svc.StartPortForward(r.Context(), req.ProfileID, req.InstanceID, req.InstanceName, req.LocalPort, req.RemotePort, req.RemoteHost, "")
	if err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}

	ok(w, map[string]string{"id": id})
}

// Terminate stops an active session.
func (h *SessionHandler) Terminate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		fail(w, http.StatusBadRequest, "id is required")
		return
	}

	if err := h.svc.Terminate(r.Context(), id); err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}

	ok(w, nil)
}

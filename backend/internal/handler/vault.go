package handler

import (
	"encoding/json"
	"net/http"

	"sesm/internal/vault"
)

type VaultHandler struct {
	v *vault.Vault
}

func NewVaultHandler(v *vault.Vault) *VaultHandler {
	return &VaultHandler{v: v}
}

func (h *VaultHandler) Status(w http.ResponseWriter, r *http.Request) {
	ok(w, map[string]any{
		"initialized":       h.v.IsInitialized(),
		"method":            string(h.v.Method()),
		"unlocked":          h.v.IsUnlocked(),
		"hasPasswordBackup": h.v.HasPasswordBackup(),
	})
}

func (h *VaultHandler) SetupPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Password == "" {
		fail(w, http.StatusBadRequest, "password required")
		return
	}
	if err := h.v.SetupPassword(req.Password); err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	ok(w, nil)
}

func (h *VaultHandler) BeginPasskeySetup(w http.ResponseWriter, r *http.Request) {
	options, err := h.v.BeginPasskeySetup()
	if err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	ok(w, options)
}

func (h *VaultHandler) FinishPasskeySetup(w http.ResponseWriter, r *http.Request) {
	session := h.v.RegSession()
	if session == nil {
		fail(w, http.StatusBadRequest, "no pending registration session")
		return
	}
	cred, err := h.v.WAInstance().FinishRegistration(h.v.WAUser(), *session, r)
	if err != nil {
		fail(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.v.FinalizePasskeySetup(cred); err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	ok(w, nil)
}

func (h *VaultHandler) UnlockPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Password == "" {
		fail(w, http.StatusBadRequest, "password required")
		return
	}
	if err := h.v.UnlockPassword(req.Password); err != nil {
		fail(w, http.StatusUnauthorized, err.Error())
		return
	}
	ok(w, nil)
}

func (h *VaultHandler) BeginPasskeyUnlock(w http.ResponseWriter, r *http.Request) {
	options, err := h.v.BeginPasskeyUnlock()
	if err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	ok(w, options)
}

func (h *VaultHandler) FinishPasskeyUnlock(w http.ResponseWriter, r *http.Request) {
	session := h.v.AuthSession()
	if session == nil {
		fail(w, http.StatusBadRequest, "no pending auth session")
		return
	}
	_, err := h.v.WAInstance().FinishLogin(h.v.WAUser(), *session, r)
	if err != nil {
		fail(w, http.StatusUnauthorized, err.Error())
		return
	}
	if err := h.v.FinalizePasskeyUnlock(); err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	ok(w, nil)
}

func (h *VaultHandler) AddPasswordBackup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Password == "" {
		fail(w, http.StatusBadRequest, "password required")
		return
	}
	if err := h.v.AddPasswordBackup(req.Password); err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	ok(w, nil)
}

func (h *VaultHandler) RemovePasswordBackup(w http.ResponseWriter, r *http.Request) {
	if err := h.v.RemovePasswordBackup(); err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	ok(w, nil)
}

func (h *VaultHandler) BeginReconfigurePasskey(w http.ResponseWriter, r *http.Request) {
	options, err := h.v.BeginReconfigurePasskey()
	if err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	ok(w, options)
}

func (h *VaultHandler) FinishReconfigurePasskey(w http.ResponseWriter, r *http.Request) {
	session := h.v.RegSession()
	if session == nil {
		fail(w, http.StatusBadRequest, "no pending registration session")
		return
	}
	cred, err := h.v.WAInstance().FinishRegistration(h.v.WAUser(), *session, r)
	if err != nil {
		fail(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.v.FinalizeReconfigurePasskey(cred); err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}
	ok(w, nil)
}

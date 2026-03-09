package handler

import (
	"encoding/json"
	"net/http"

	awsclient "sesm/internal/aws"
	"sesm/internal/model"
	"sesm/internal/store"
)

// InstanceHandler handles EC2/SSM instance queries.
type InstanceHandler struct {
	profiles  *store.ProfileStore
	instances *store.InstanceStore
}

// NewInstanceHandler creates an InstanceHandler.
func NewInstanceHandler(p *store.ProfileStore, i *store.InstanceStore) *InstanceHandler {
	return &InstanceHandler{profiles: p, instances: i}
}

// List returns all instances with the SSM agent registered for the given profile.
func (h *InstanceHandler) List(w http.ResponseWriter, r *http.Request) {
	profileID := r.URL.Query().Get("profileId")
	if profileID == "" {
		fail(w, http.StatusBadRequest, "profileId query parameter is required")
		return
	}

	profile, err := h.profiles.GetByID(r.Context(), profileID)
	if err != nil {
		if err.Error() == "not found" {
			fail(w, http.StatusNotFound, "profile not found")
			return
		}
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}

	aliases, err := h.instances.GetAliases(r.Context())
	if err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}

	client := &awsclient.Client{
		AccessKeyID:     profile.AccessKeyID,
		SecretAccessKey: profile.SecretAccessKey,
		Region:          profile.Region,
	}

	infos, err := client.DescribeInstanceInformation(r.Context())
	if err != nil {
		fail(w, http.StatusBadGateway, err.Error())
		return
	}

	instances := make([]model.Instance, 0, len(infos))
	for _, info := range infos {
		state := "offline"
		if info.PingStatus == "Online" {
			state = "running"
		}

		name := info.ComputerName
		if name == "" {
			name = info.InstanceId
		}

		instances = append(instances, model.Instance{
			InstanceId:   info.InstanceId,
			Name:         name,
			Alias:        aliases[info.InstanceId],
			Type:         info.PlatformType,
			State:        state,
			Platform:     info.PlatformName,
			PrivateIp:    info.IPAddress,
			ResourceType: info.ResourceType,
		})
	}

	ok(w, instances)
}

// SetAlias updates the friendly alias for an instance.
func (h *InstanceHandler) SetAlias(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		fail(w, http.StatusBadRequest, "id is required")
		return
	}

	var req struct {
		Alias string `json:"alias"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fail(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.instances.SetAlias(r.Context(), id, req.Alias); err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}

	ok(w, nil)
}

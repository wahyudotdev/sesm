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

	// Collect EC2 instance IDs (on-prem managed nodes start with "mi-", skip those).
	var ec2IDs []string
	for _, info := range infos {
		if len(info.InstanceId) > 0 && info.InstanceId[:2] == "i-" {
			ec2IDs = append(ec2IDs, info.InstanceId)
		}
	}

	// Best-effort: fetch instance details (name and state) from EC2. If this fails (e.g. missing ec2:Describe* permission),
	// fall back to SSM PingStatus for state and ComputerName for name.
	ec2Details, _ := client.DescribeInstanceDetails(r.Context(), ec2IDs)

	instances := make([]model.Instance, 0, len(infos))
	for _, info := range infos {
		var state string
		if details, ok := ec2Details[info.InstanceId]; ok && details.State != "" {
			// Use actual EC2 state if available
			state = details.State
		} else {
			// Fallback to SSM PingStatus
			state = "offline"
			if info.PingStatus == "Online" {
				state = "running"
			}
		}

		var name string
		if details, ok := ec2Details[info.InstanceId]; ok && details.Name != "" {
			name = details.Name
		} else {
			name = info.ComputerName
		}
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

// Reboot reboots the specified EC2 instance.
func (h *InstanceHandler) Reboot(w http.ResponseWriter, r *http.Request) {
	instanceID := r.PathValue("id")
	if instanceID == "" {
		fail(w, http.StatusBadRequest, "id is required")
		return
	}

	// Check if this is an EC2 instance (starts with "i-")
	if len(instanceID) < 2 || instanceID[:2] != "i-" {
		fail(w, http.StatusBadRequest, "reboot is only supported for EC2 instances")
		return
	}

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

	client := &awsclient.Client{
		AccessKeyID:     profile.AccessKeyID,
		SecretAccessKey: profile.SecretAccessKey,
		Region:          profile.Region,
	}

	if err := client.RebootInstances(r.Context(), []string{instanceID}); err != nil {
		fail(w, http.StatusInternalServerError, err.Error())
		return
	}

	ok(w, nil)
}

package model

import "time"

// PortForwardRule represents a saved port-forwarding configuration.
type PortForwardRule struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	ProfileID    string    `json:"profileId"`
	InstanceID   string    `json:"instanceId"`
	InstanceName string    `json:"instanceName"`
	LocalPort    int       `json:"localPort"`
	RemotePort   int       `json:"remotePort"`
	RemoteHost   string    `json:"remoteHost"`
	Enabled      bool      `json:"enabled"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// CreateRuleRequest is the body expected when creating a new rule.
type CreateRuleRequest struct {
	Name         string `json:"name"`
	ProfileID    string `json:"profileId"`
	InstanceID   string `json:"instanceId"`
	InstanceName string `json:"instanceName"`
	LocalPort    int    `json:"localPort"`
	RemotePort   int    `json:"remotePort"`
	RemoteHost   string `json:"remoteHost"`
}

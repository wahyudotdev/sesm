package model

// Instance represents an EC2 or managed instance visible via SSM.
type Instance struct {
	InstanceId   string `json:"instanceId"`
	Name         string `json:"name"`
	Type         string `json:"type"`
	State        string `json:"state"` // "running" | "offline"
	Platform     string `json:"platform"`
	PrivateIp    string `json:"privateIp"`
	ResourceType string `json:"resourceType"`
}

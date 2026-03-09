package aws

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// Client holds credentials for AWS API calls.
type Client struct {
	AccessKeyID     string
	SecretAccessKey string
	Region          string
}

// InstanceInfo represents an SSM-managed instance.
type InstanceInfo struct {
	InstanceId   string `json:"InstanceId"`
	ComputerName string `json:"ComputerName"`
	IPAddress    string `json:"IPAddress"`
	PingStatus   string `json:"PingStatus"`
	PlatformName string `json:"PlatformName"`
	PlatformType string `json:"PlatformType"`
	ResourceType string `json:"ResourceType"`
}

// StartSessionOutput holds the SSM StartSession response fields.
type StartSessionOutput struct {
	SessionId  string `json:"SessionId"`
	StreamUrl  string `json:"StreamUrl"`
	TokenValue string `json:"TokenValue"`
}

// DescribeInstanceInformation returns all SSM-managed instances, paginating via NextToken.
func (c *Client) DescribeInstanceInformation(ctx context.Context) ([]InstanceInfo, error) {
	type requestBody struct {
		MaxResults int    `json:"MaxResults"`
		NextToken  string `json:"NextToken,omitempty"`
	}
	type responseBody struct {
		InstanceInformationList []InstanceInfo `json:"InstanceInformationList"`
		NextToken               string         `json:"NextToken"`
	}

	var all []InstanceInfo
	var nextToken string

	for {
		reqBody := requestBody{MaxResults: 50, NextToken: nextToken}
		body, err := json.Marshal(reqBody)
		if err != nil {
			return nil, fmt.Errorf("marshal request: %w", err)
		}

		var resp responseBody
		if err := c.post(ctx, "AmazonSSM.DescribeInstanceInformation", body, &resp); err != nil {
			return nil, err
		}

		all = append(all, resp.InstanceInformationList...)

		if resp.NextToken == "" {
			break
		}
		nextToken = resp.NextToken
	}

	return all, nil
}

// StartSession starts an SSM session with the given instance.
func (c *Client) StartSession(ctx context.Context, instanceID string) (*StartSessionOutput, error) {
	body, err := json.Marshal(map[string]string{"Target": instanceID})
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	var out StartSessionOutput
	if err := c.post(ctx, "AmazonSSM.StartSession", body, &out); err != nil {
		return nil, err
	}

	return &out, nil
}

// post performs a signed POST to the SSM endpoint.
func (c *Client) post(ctx context.Context, target string, body []byte, out any) error {
	url := fmt.Sprintf("https://ssm.%s.amazonaws.com/", c.Region)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("new request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-amz-json-1.1")
	req.Header.Set("X-Amz-Target", target)

	creds := Credentials{
		AccessKeyID:     c.AccessKeyID,
		SecretAccessKey: c.SecretAccessKey,
		Region:          c.Region,
		Service:         "ssm",
	}
	if err := Sign(req, body, creds); err != nil {
		return fmt.Errorf("sign request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errBody map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&errBody)
		return fmt.Errorf("ssm %s: status %d: %v", target, resp.StatusCode, errBody)
	}

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}

	return nil
}

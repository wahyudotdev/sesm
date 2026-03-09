package aws

import (
	"context"
	"encoding/xml"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// ec2DescribeInstancesResponse is a minimal parse of the EC2 DescribeInstances XML.
type ec2DescribeInstancesResponse struct {
	Reservations []ec2Reservation `xml:"reservationSet>item"`
}

type ec2Reservation struct {
	Instances []ec2Instance `xml:"instancesSet>item"`
}

type ec2Instance struct {
	InstanceId string   `xml:"instanceId"`
	Tags       []ec2Tag `xml:"tagSet>item"`
}

type ec2Tag struct {
	Key   string `xml:"key"`
	Value string `xml:"value"`
}

// DescribeInstanceNames returns a map of instanceID → Name tag value for the
// given list of instance IDs. IDs not found in EC2 (e.g. on-prem managed nodes)
// are simply absent from the map.
func (c *Client) DescribeInstanceNames(ctx context.Context, instanceIDs []string) (map[string]string, error) {
	if len(instanceIDs) == 0 {
		return map[string]string{}, nil
	}

	form := url.Values{}
	form.Set("Action", "DescribeInstances")
	form.Set("Version", "2016-11-15")
	for i, id := range instanceIDs {
		form.Set("Filter.1.Name", "instance-id")
		form.Set(fmt.Sprintf("Filter.1.Value.%d", i+1), id)
	}

	body := []byte(form.Encode())

	endpoint := fmt.Sprintf("https://ec2.%s.amazonaws.com/", c.Region)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(string(body)))
	if err != nil {
		return nil, fmt.Errorf("ec2 new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	creds := Credentials{
		AccessKeyID:     c.AccessKeyID,
		SecretAccessKey: c.SecretAccessKey,
		Region:          c.Region,
		Service:         "ec2",
	}
	if err := Sign(req, body, creds); err != nil {
		return nil, fmt.Errorf("ec2 sign: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ec2 request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("ec2 DescribeInstances: status %d", resp.StatusCode)
	}

	var parsed ec2DescribeInstancesResponse
	if err := xml.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("ec2 decode: %w", err)
	}

	names := make(map[string]string, len(instanceIDs))
	for _, r := range parsed.Reservations {
		for _, inst := range r.Instances {
			for _, tag := range inst.Tags {
				if tag.Key == "Name" && tag.Value != "" {
					names[inst.InstanceId] = tag.Value
					break
				}
			}
		}
	}
	return names, nil
}

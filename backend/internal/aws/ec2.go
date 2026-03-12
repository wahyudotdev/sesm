package aws

import (
	"context"
	"encoding/xml"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
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
	State      ec2State `xml:"state"`
	Tags       []ec2Tag `xml:"tagSet>item"`
}

type ec2State struct {
	Name string `xml:"name"`
}

type ec2Tag struct {
	Key   string `xml:"key"`
	Value string `xml:"value"`
}

// ec2RebootInstancesResponse is a minimal parse of the EC2 RebootInstances XML.
type ec2RebootInstancesResponse struct {
	RequestId string `xml:"requestId"`
}

// InstanceDetails holds instance metadata from EC2.
type InstanceDetails struct {
	Name  string
	State string
}

// DescribeInstanceDetails returns a map of instanceID → {name, state} for the
// given list of instance IDs. IDs not found in EC2 (e.g. on-prem managed nodes)
// are simply absent from the map.
func (c *Client) DescribeInstanceDetails(ctx context.Context, instanceIDs []string) (map[string]InstanceDetails, error) {
	if len(instanceIDs) == 0 {
		return map[string]InstanceDetails{}, nil
	}

	form := url.Values{}
	form.Set("Action", "DescribeInstances")
	form.Set("Version", "2016-11-15")
	for i, id := range instanceIDs {
		form.Set(fmt.Sprintf("InstanceId.%d", i+1), id)
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

	log.Printf("aws ec2 DescribeInstances: querying %d instance(s)", len(instanceIDs))
	start := time.Now()
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("aws ec2 DescribeInstances: request failed (%s): %v", time.Since(start).Round(time.Millisecond), err)
		return nil, fmt.Errorf("ec2 request: %w", err)
	}
	defer resp.Body.Close()

	log.Printf("aws ec2 DescribeInstances: %d (%s)", resp.StatusCode, time.Since(start).Round(time.Millisecond))

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("ec2 DescribeInstances: status %d", resp.StatusCode)
	}

	var parsed ec2DescribeInstancesResponse
	if err := xml.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("ec2 decode: %w", err)
	}

	details := make(map[string]InstanceDetails, len(instanceIDs))
	for _, r := range parsed.Reservations {
		for _, inst := range r.Instances {
			var name string
			for _, tag := range inst.Tags {
				if tag.Key == "Name" && tag.Value != "" {
					name = tag.Value
					break
				}
			}
			details[inst.InstanceId] = InstanceDetails{
				Name:  name,
				State: inst.State.Name,
			}
		}
	}
	return details, nil
}

// RebootInstances reboots the specified EC2 instances.
func (c *Client) RebootInstances(ctx context.Context, instanceIDs []string) error {
	if len(instanceIDs) == 0 {
		return fmt.Errorf("no instance IDs provided")
	}

	form := url.Values{}
	form.Set("Action", "RebootInstances")
	form.Set("Version", "2016-11-15")
	for i, id := range instanceIDs {
		form.Set(fmt.Sprintf("InstanceId.%d", i+1), id)
	}

	body := []byte(form.Encode())

	endpoint := fmt.Sprintf("https://ec2.%s.amazonaws.com/", c.Region)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(string(body)))
	if err != nil {
		return fmt.Errorf("ec2 new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	creds := Credentials{
		AccessKeyID:     c.AccessKeyID,
		SecretAccessKey: c.SecretAccessKey,
		Region:          c.Region,
		Service:         "ec2",
	}
	if err := Sign(req, body, creds); err != nil {
		return fmt.Errorf("ec2 sign: %w", err)
	}

	log.Printf("aws ec2 RebootInstances: rebooting %d instance(s): %s", len(instanceIDs), strings.Join(instanceIDs, ", "))
	start := time.Now()
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("aws ec2 RebootInstances: request failed (%s): %v", time.Since(start).Round(time.Millisecond), err)
		return fmt.Errorf("ec2 request: %w", err)
	}
	defer resp.Body.Close()

	log.Printf("aws ec2 RebootInstances: %d (%s)", resp.StatusCode, time.Since(start).Round(time.Millisecond))

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("ec2 RebootInstances: status %d", resp.StatusCode)
	}

	return nil
}

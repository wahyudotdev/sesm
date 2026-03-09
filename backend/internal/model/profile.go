package model

import "time"

// Profile holds an AWS credential profile used to authenticate SSM/EC2 calls.
type Profile struct {
	ID              string    `db:"id" json:"id"`
	Name            string    `db:"name" json:"name"`
	Region          string    `db:"region" json:"region"`
	AccessKeyID     string    `db:"access_key_id" json:"accessKeyId"`
	SecretAccessKey string    `db:"secret_access_key" json:"-"` // never serialised
	AccountID       string    `db:"account_id" json:"accountId,omitempty"`
	CreatedAt       time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt       time.Time `db:"updated_at" json:"updatedAt"`
}

// CreateProfileRequest is the body expected when creating a new profile.
type CreateProfileRequest struct {
	Name            string `json:"name"`
	Region          string `json:"region"`
	AccessKeyID     string `json:"accessKeyId"`
	SecretAccessKey string `json:"secretAccessKey"`
	AccountID       string `json:"accountId,omitempty"`
}

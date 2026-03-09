package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"sesm/internal/model"
)

// ProfileRepo handles persistence for AWS credential profiles.
type ProfileRepo struct {
	db *sqlx.DB
}

// NewProfileRepo creates a ProfileRepo backed by db.
func NewProfileRepo(db *sqlx.DB) *ProfileRepo {
	return &ProfileRepo{db: db}
}

// List returns all profiles ordered by name.
func (r *ProfileRepo) List(ctx context.Context) ([]model.Profile, error) {
	rows := make([]model.Profile, 0)

	err := r.db.SelectContext(ctx, &rows, `
		SELECT id, name, region, access_key_id, account_id, created_at, updated_at
		FROM profiles
		ORDER BY name
	`)
	if err != nil {
		return nil, fmt.Errorf("list profiles: %w", err)
	}

	return rows, nil
}

// GetByID returns the profile with the given ID, including the secret key.
func (r *ProfileRepo) GetByID(ctx context.Context, id string) (*model.Profile, error) {
	var p model.Profile

	err := r.db.GetContext(ctx, &p, `
		SELECT id, name, region, access_key_id, secret_access_key, account_id, created_at, updated_at
		FROM profiles WHERE id = ?
	`, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}

	if err != nil {
		return nil, fmt.Errorf("get profile: %w", err)
	}

	return &p, nil
}

// Create inserts a new profile and returns it.
func (r *ProfileRepo) Create(ctx context.Context, req model.CreateProfileRequest) (*model.Profile, error) {
	now := time.Now().UTC()
	p := model.Profile{
		ID:              uuid.NewString(),
		Name:            req.Name,
		Region:          req.Region,
		AccessKeyID:     req.AccessKeyID,
		SecretAccessKey: req.SecretAccessKey,
		AccountID:       req.AccountID,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO profiles (id, name, region, access_key_id, secret_access_key, account_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, p.ID, p.Name, p.Region, p.AccessKeyID, p.SecretAccessKey, p.AccountID, p.CreatedAt, p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create profile: %w", err)
	}

	return &p, nil
}

// Delete removes a profile by ID. Returns ErrNotFound if it does not exist.
func (r *ProfileRepo) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM profiles WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete profile: %w", err)
	}

	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}

	return nil
}

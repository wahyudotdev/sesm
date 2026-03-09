package store

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"sesm/internal/model"
	"sesm/internal/vault"
)

// profileRecord persists all profile fields including the secret key.
type profileRecord struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Region          string    `json:"region"`
	AccessKeyID     string    `json:"accessKeyId"`
	SecretAccessKey string    `json:"secretAccessKey"`
	AccountID       string    `json:"accountId,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// ProfileStore is a thread-safe JSON flat-file store for profiles.
type ProfileStore struct {
	mu    sync.RWMutex
	path  string
	vault *vault.Vault
}

// NewProfileStore creates a ProfileStore backed by dir/profiles.json.
func NewProfileStore(dir string, v *vault.Vault) *ProfileStore {
	_ = os.MkdirAll(dir, 0o700)
	return &ProfileStore{path: filepath.Join(dir, "profiles.json"), vault: v}
}

func (s *ProfileStore) load() ([]profileRecord, error) {
	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return []profileRecord{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read profiles: %w", err)
	}

	if s.vault != nil && s.vault.IsInitialized() {
		if !s.vault.IsUnlocked() {
			return nil, errors.New("vault is locked")
		}
		data, err = s.vault.Decrypt(data)
		if err != nil {
			return nil, fmt.Errorf("decrypt profiles: %w", err)
		}
	}

	var records []profileRecord
	if err := json.Unmarshal(data, &records); err != nil {
		return nil, fmt.Errorf("parse profiles: %w", err)
	}
	return records, nil
}

func (s *ProfileStore) save(records []profileRecord) error {
	data, err := json.Marshal(records)
	if err != nil {
		return fmt.Errorf("marshal profiles: %w", err)
	}

	if s.vault != nil && s.vault.IsInitialized() {
		if !s.vault.IsUnlocked() {
			return errors.New("vault is locked")
		}
		data, err = s.vault.Encrypt(data)
		if err != nil {
			return fmt.Errorf("encrypt profiles: %w", err)
		}
	}

	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("write profiles tmp: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return fmt.Errorf("rename profiles: %w", err)
	}
	return nil
}

// List returns all profiles without the secret access key.
func (s *ProfileStore) List(_ context.Context) ([]model.Profile, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	records, err := s.load()
	if err != nil {
		return nil, err
	}

	profiles := make([]model.Profile, 0, len(records))
	for _, r := range records {
		profiles = append(profiles, model.Profile{
			ID:          r.ID,
			Name:        r.Name,
			Region:      r.Region,
			AccessKeyID: r.AccessKeyID,
			AccountID:   r.AccountID,
			CreatedAt:   r.CreatedAt,
			UpdatedAt:   r.UpdatedAt,
		})
	}
	return profiles, nil
}

// GetByID returns the profile with the given ID, including SecretAccessKey.
func (s *ProfileStore) GetByID(_ context.Context, id string) (*model.Profile, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	records, err := s.load()
	if err != nil {
		return nil, err
	}

	for _, r := range records {
		if r.ID == id {
			p := &model.Profile{
				ID:              r.ID,
				Name:            r.Name,
				Region:          r.Region,
				AccessKeyID:     r.AccessKeyID,
				SecretAccessKey: r.SecretAccessKey,
				AccountID:       r.AccountID,
				CreatedAt:       r.CreatedAt,
				UpdatedAt:       r.UpdatedAt,
			}
			return p, nil
		}
	}

	return nil, errors.New("not found")
}

// Create inserts a new profile and returns it (without secret).
func (s *ProfileStore) Create(_ context.Context, req model.CreateProfileRequest) (*model.Profile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	records, err := s.load()
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	r := profileRecord{
		ID:              newID(),
		Name:            req.Name,
		Region:          req.Region,
		AccessKeyID:     req.AccessKeyID,
		SecretAccessKey: req.SecretAccessKey,
		AccountID:       req.AccountID,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	records = append(records, r)

	if err := s.save(records); err != nil {
		return nil, err
	}

	return &model.Profile{
		ID:          r.ID,
		Name:        r.Name,
		Region:      r.Region,
		AccessKeyID: r.AccessKeyID,
		AccountID:   r.AccountID,
		CreatedAt:   r.CreatedAt,
		UpdatedAt:   r.UpdatedAt,
	}, nil
}

// Delete removes a profile by ID.
func (s *ProfileStore) Delete(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	records, err := s.load()
	if err != nil {
		return err
	}

	idx := -1
	for i, r := range records {
		if r.ID == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		return errors.New("not found")
	}

	records = append(records[:idx], records[idx+1:]...)
	return s.save(records)
}

// newID generates a random UUID v4.
func newID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant bits
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"sesm/internal/model"
)

// RuleStore is a thread-safe JSON flat-file store for port-forwarding rules.
type RuleStore struct {
	mu   sync.RWMutex
	path string
}

// NewRuleStore creates a RuleStore backed by dir/rules.json.
func NewRuleStore(dir string) *RuleStore {
	_ = os.MkdirAll(dir, 0o700)
	return &RuleStore{path: filepath.Join(dir, "rules.json")}
}

func (s *RuleStore) load() ([]model.PortForwardRule, error) {
	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return []model.PortForwardRule{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read rules: %w", err)
	}
	var records []model.PortForwardRule
	if err := json.Unmarshal(data, &records); err != nil {
		return nil, fmt.Errorf("parse rules: %w", err)
	}
	return records, nil
}

func (s *RuleStore) save(records []model.PortForwardRule) error {
	data, err := json.Marshal(records)
	if err != nil {
		return fmt.Errorf("marshal rules: %w", err)
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("write rules tmp: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return fmt.Errorf("rename rules: %w", err)
	}
	return nil
}

// List returns all saved rules.
func (s *RuleStore) List(_ context.Context) ([]model.PortForwardRule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.load()
}

// GetByID returns a rule by ID.
func (s *RuleStore) GetByID(_ context.Context, id string) (*model.PortForwardRule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	records, err := s.load()
	if err != nil {
		return nil, err
	}
	for _, r := range records {
		if r.ID == id {
			return &r, nil
		}
	}
	return nil, errors.New("not found")
}

// Create persists a new rule.
func (s *RuleStore) Create(_ context.Context, req model.CreateRuleRequest) (*model.PortForwardRule, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	records, err := s.load()
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	r := model.PortForwardRule{
		ID:           newID(),
		Name:         req.Name,
		ProfileID:    req.ProfileID,
		InstanceID:   req.InstanceID,
		InstanceName: req.InstanceName,
		LocalPort:    req.LocalPort,
		RemotePort:   req.RemotePort,
		RemoteHost:   req.RemoteHost,
		Enabled:      true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	records = append(records, r)

	if err := s.save(records); err != nil {
		return nil, err
	}

	return &r, nil
}

// UpdateEnabled toggles the enabled state of a rule.
func (s *RuleStore) UpdateEnabled(_ context.Context, id string, enabled bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	records, err := s.load()
	if err != nil {
		return err
	}

	for i := range records {
		if records[i].ID == id {
			records[i].Enabled = enabled
			records[i].UpdatedAt = time.Now().UTC()
			return s.save(records)
		}
	}

	return errors.New("not found")
}

// Delete removes a rule by ID.
func (s *RuleStore) Delete(_ context.Context, id string) error {
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

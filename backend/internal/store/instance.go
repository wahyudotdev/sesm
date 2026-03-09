package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"sesm/internal/vault"
)

// InstanceStore persists aliases for EC2/SSM instances.
type InstanceStore struct {
	mu    sync.RWMutex
	path  string
	vault *vault.Vault
}

// NewInstanceStore creates an InstanceStore backed by dir/instances.json.
func NewInstanceStore(dir string, v *vault.Vault) *InstanceStore {
	_ = os.MkdirAll(dir, 0o700)
	return &InstanceStore{path: filepath.Join(dir, "instances.json"), vault: v}
}

func (s *InstanceStore) load() (map[string]string, error) {
	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return make(map[string]string), nil
	}
	if err != nil {
		return nil, fmt.Errorf("read instances: %w", err)
	}

	if s.vault != nil && s.vault.IsInitialized() {
		if !s.vault.IsUnlocked() {
			return nil, errors.New("vault is locked")
		}
		data, err = s.vault.Decrypt(data)
		if err != nil {
			return nil, fmt.Errorf("decrypt instances: %w", err)
		}
	}

	var aliases map[string]string
	if err := json.Unmarshal(data, &aliases); err != nil {
		return nil, fmt.Errorf("parse instances: %w", err)
	}
	return aliases, nil
}

func (s *InstanceStore) save(aliases map[string]string) error {
	data, err := json.Marshal(aliases)
	if err != nil {
		return fmt.Errorf("marshal instances: %w", err)
	}

	if s.vault != nil && s.vault.IsInitialized() {
		if !s.vault.IsUnlocked() {
			return errors.New("vault is locked")
		}
		data, err = s.vault.Encrypt(data)
		if err != nil {
			return fmt.Errorf("encrypt instances: %w", err)
		}
	}

	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("write instances tmp: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return fmt.Errorf("rename instances: %w", err)
	}
	return nil
}

// GetAliases returns all stored instance aliases.
func (s *InstanceStore) GetAliases(_ context.Context) (map[string]string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.load()
}

// SetAlias saves a friendly alias for an instance.
func (s *InstanceStore) SetAlias(_ context.Context, instanceID, alias string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	aliases, err := s.load()
	if err != nil {
		return err
	}

	if alias == "" {
		delete(aliases, instanceID)
	} else {
		aliases[instanceID] = alias
	}

	return s.save(aliases)
}

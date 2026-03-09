package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"sesm/internal/model"
	"sesm/internal/vault"
)

// SessionStore is a thread-safe JSON flat-file store for sessions.
type SessionStore struct {
	mu    sync.RWMutex
	path  string
	vault *vault.Vault
}

// NewSessionStore creates a SessionStore backed by dir/sessions.json.
func NewSessionStore(dir string, v *vault.Vault) *SessionStore {
	_ = os.MkdirAll(dir, 0o700)
	return &SessionStore{path: filepath.Join(dir, "sessions.json"), vault: v}
}

func (s *SessionStore) load() ([]model.Session, error) {
	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return []model.Session{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read sessions: %w", err)
	}

	if s.vault != nil && s.vault.IsInitialized() {
		if !s.vault.IsUnlocked() {
			return nil, errors.New("vault is locked")
		}
		data, err = s.vault.Decrypt(data)
		if err != nil {
			return nil, fmt.Errorf("decrypt sessions: %w", err)
		}
	}

	var records []model.Session
	if err := json.Unmarshal(data, &records); err != nil {
		return nil, fmt.Errorf("parse sessions: %w", err)
	}
	return records, nil
}

func (s *SessionStore) save(records []model.Session) error {
	data, err := json.Marshal(records)
	if err != nil {
		return fmt.Errorf("marshal sessions: %w", err)
	}

	if s.vault != nil && s.vault.IsInitialized() {
		if !s.vault.IsUnlocked() {
			return errors.New("vault is locked")
		}
		data, err = s.vault.Encrypt(data)
		if err != nil {
			return fmt.Errorf("encrypt sessions: %w", err)
		}
	}

	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("write sessions tmp: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return fmt.Errorf("rename sessions: %w", err)
	}
	return nil
}

// Create persists a new session.
func (s *SessionStore) Create(_ context.Context, sess model.Session) (*model.Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	records, err := s.load()
	if err != nil {
		return nil, err
	}

	if sess.ID == "" {
		sess.ID = newID()
	}

	records = append(records, sess)
	if err := s.save(records); err != nil {
		return nil, err
	}

	return &sess, nil
}

// List returns all sessions.
func (s *SessionStore) List(_ context.Context) ([]model.Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.load()
}

// ListRecent returns up to n sessions, newest first (by StartedAt order in file, last n).
func (s *SessionStore) ListRecent(n int) ([]model.Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	records, err := s.load()
	if err != nil {
		return nil, err
	}

	// Return last n (most recently appended).
	if len(records) > n {
		records = records[len(records)-n:]
	}

	// Reverse for newest-first ordering.
	for i, j := 0, len(records)-1; i < j; i, j = i+1, j-1 {
		records[i], records[j] = records[j], records[i]
	}

	return records, nil
}

// UpdateStatus updates the status of a session by ID.
func (s *SessionStore) UpdateStatus(_ context.Context, id string, status model.SessionStatus) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	records, err := s.load()
	if err != nil {
		return err
	}

	for i := range records {
		if records[i].ID == id {
			records[i].Status = status
			return s.save(records)
		}
	}

	return errors.New("session not found")
}

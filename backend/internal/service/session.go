package service

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"sync"
	"time"

	awsclient "sesm/internal/aws"
	"sesm/internal/model"
	"sesm/internal/pty"
	"sesm/internal/store"
)

// newID generates a random UUID v4.
func newID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant bits
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// ManagedSession tracks an active OS process for a session.
type ManagedSession struct {
	Session *model.Session
	Cmd     *exec.Cmd
	Ptm     *os.File // Only for terminal sessions
	Cancel  context.CancelFunc
}

// SessionService manages the lifecycle of SSM sessions.
type SessionService struct {
	profiles *store.ProfileStore
	sessions *store.SessionStore
	active   map[string]*ManagedSession
	mu       sync.RWMutex
}

// CheckPlugin verifies that session-manager-plugin is installed and on PATH.
func CheckPlugin() error {
	_, err := exec.LookPath("session-manager-plugin")
	if err != nil {
		return fmt.Errorf(
			"session-manager-plugin not found — install it from: " +
				"https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html",
		)
	}
	return nil
}

// NewSessionService creates a SessionService.
func NewSessionService(p *store.ProfileStore, s *store.SessionStore) *SessionService {
	return &SessionService{
		profiles: p,
		sessions: s,
		active:   make(map[string]*ManagedSession),
	}
}

// StartTerminal initiates a terminal session and returns the PTY file.
func (s *SessionService) StartTerminal(ctx context.Context, profileID, instanceID, instanceName string) (string, *os.File, error) {
	profile, err := s.profiles.GetByID(ctx, profileID)
	if err != nil {
		return "", nil, fmt.Errorf("get profile: %w", err)
	}

	client := &awsclient.Client{
		AccessKeyID:     profile.AccessKeyID,
		SecretAccessKey: profile.SecretAccessKey,
		Region:          profile.Region,
	}

	input := &awsclient.StartSessionInput{
		Target: instanceID,
	}

	out, err := client.StartSession(ctx, input)
	if err != nil {
		return "", nil, err
	}

	// Persist session record
	now := time.Now()
	sess, err := s.sessions.Create(ctx, model.Session{
		ProfileID:    profile.ID,
		ProfileName:  profile.Name,
		InstanceID:   instanceID,
		InstanceName: instanceName,
		Type:         model.SessionTypeTerminal,
		Status:       model.SessionStatusActive,
		StartedAt:    now,
	})
	if err != nil {
		return "", nil, fmt.Errorf("persist session: %w", err)
	}

	sessionJSON, _ := json.Marshal(map[string]string{
		"SessionId":  out.SessionId,
		"StreamUrl":  out.StreamUrl,
		"TokenValue": out.TokenValue,
	})
	paramsJSON, _ := json.Marshal(map[string]string{
		"Target": instanceID,
	})
	endpoint := fmt.Sprintf("https://ssm.%s.amazonaws.com", profile.Region)

	cmdCtx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(cmdCtx, "session-manager-plugin",
		string(sessionJSON),
		profile.Region,
		"StartSession",
		"",
		string(paramsJSON),
		endpoint,
	)
	cmd.Env = os.Environ()

	ptm, err := pty.Start(cmd)
	if err != nil {
		cancel()
		_ = s.sessions.UpdateStatus(ctx, sess.ID, model.SessionStatusFailed)
		return "", nil, fmt.Errorf("start session-manager-plugin: %w", err)
	}

	managed := &ManagedSession{
		Session: sess,
		Cmd:     cmd,
		Ptm:     ptm,
		Cancel:  cancel,
	}

	s.mu.Lock()
	s.active[sess.ID] = managed
	s.mu.Unlock()

	// Monitor for exit
	go s.monitor(sess.ID, managed)

	return sess.ID, ptm, nil
}

// StartPortForward initiates a port-forwarding session.
func (s *SessionService) StartPortForward(ctx context.Context, profileID, instanceID, instanceName string, localPort, remotePort int, remoteHost string) (string, error) {
	profile, err := s.profiles.GetByID(ctx, profileID)
	if err != nil {
		return "", fmt.Errorf("get profile: %w", err)
	}

	client := &awsclient.Client{
		AccessKeyID:     profile.AccessKeyID,
		SecretAccessKey: profile.SecretAccessKey,
		Region:          profile.Region,
	}

	params := map[string][]string{
		"portNumber":      {fmt.Sprintf("%d", remotePort)},
		"localPortNumber": {fmt.Sprintf("%d", localPort)},
	}
	doc := "AWS-StartPortForwardingSession"
	if remoteHost != "" {
		doc = "AWS-StartPortForwardingSessionToRemoteHost"
		params["host"] = []string{remoteHost}
	}

	input := &awsclient.StartSessionInput{
		Target:       instanceID,
		DocumentName: doc,
		Parameters:   params,
	}

	out, err := client.StartSession(ctx, input)
	if err != nil {
		return "", err
	}

	now := time.Now()
	sess, err := s.sessions.Create(ctx, model.Session{
		ProfileID:    profile.ID,
		ProfileName:  profile.Name,
		InstanceID:   instanceID,
		InstanceName: instanceName,
		Type:         model.SessionTypePortForward,
		Status:       model.SessionStatusActive,
		LocalPort:    &localPort,
		RemotePort:   &remotePort,
		RemoteHost:   &remoteHost,
		StartedAt:    now,
	})
	if err != nil {
		return "", fmt.Errorf("persist session: %w", err)
	}

	sessionJSON, _ := json.Marshal(map[string]string{
		"SessionId":  out.SessionId,
		"StreamUrl":  out.StreamUrl,
		"TokenValue": out.TokenValue,
	})
	paramsJSON, _ := json.Marshal(input)
	endpoint := fmt.Sprintf("https://ssm.%s.amazonaws.com", profile.Region)

	fmt.Printf("Starting port forward: doc=%s, params=%s\n", doc, string(paramsJSON))

	cmdCtx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(cmdCtx, "session-manager-plugin",
		string(sessionJSON),
		profile.Region,
		"StartSession",
		"",
		string(paramsJSON),
		endpoint,
	)
	cmd.Env = os.Environ()

	// Redirect output to server logs for debugging
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		cancel()
		_ = s.sessions.UpdateStatus(ctx, sess.ID, model.SessionStatusFailed)
		return "", fmt.Errorf("start session-manager-plugin: %w", err)
	}

	managed := &ManagedSession{
		Session: sess,
		Cmd:     cmd,
		Cancel:  cancel,
	}

	s.mu.Lock()
	s.active[sess.ID] = managed
	s.mu.Unlock()

	go s.monitor(sess.ID, managed)

	return sess.ID, nil
}

// Terminate stops a session by ID.
func (s *SessionService) Terminate(ctx context.Context, id string) error {
	s.mu.Lock()
	managed, ok := s.active[id]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("session %s not active or already terminated", id)
	}
	delete(s.active, id)
	s.mu.Unlock()

	managed.Cancel()
	if managed.Ptm != nil {
		_ = managed.Ptm.Close()
	}

	return s.sessions.UpdateStatus(ctx, id, model.SessionStatusTerminated)
}

func (s *SessionService) monitor(id string, m *ManagedSession) {
	_ = m.Cmd.Wait()

	s.mu.Lock()
	if _, ok := s.active[id]; ok {
		delete(s.active, id)
		s.mu.Unlock()
		// If it exited on its own, update status
		_ = s.sessions.UpdateStatus(context.Background(), id, model.SessionStatusTerminated)
	} else {
		s.mu.Unlock()
	}
}

// Setsize resizes the PTY.
func Setsize(ptm *os.File, rows, cols uint16) error {
	return pty.Setsize(ptm, rows, cols)
}

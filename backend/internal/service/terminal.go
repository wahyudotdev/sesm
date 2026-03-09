package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"

	awsclient "sesm/internal/aws"
	"sesm/internal/pty"
	"sesm/internal/store"
)

// TerminalSession wraps an active session-manager-plugin process running in a PTY.
type TerminalSession struct {
	ptm    *os.File
	cmd    *exec.Cmd
	cancel context.CancelFunc
}

// Read reads raw terminal output from the PTY master.
func (s *TerminalSession) Read(p []byte) (int, error) {
	return s.ptm.Read(p)
}

// Write sends raw terminal input to the PTY master.
func (s *TerminalSession) Write(p []byte) (int, error) {
	return s.ptm.Write(p)
}

// Resize resizes the PTY so the remote shell reflows correctly.
func (s *TerminalSession) Resize(cols, rows uint16) error {
	return pty.Setsize(s.ptm, rows, cols)
}

// Close terminates the subprocess and frees resources.
func (s *TerminalSession) Close() {
	_ = s.ptm.Close()
	s.cancel()
	_ = s.cmd.Wait()
}

// TerminalService starts SSM terminal sessions via session-manager-plugin.
type TerminalService struct {
	profiles *store.ProfileStore
}

// NewTerminalService creates a TerminalService.
func NewTerminalService(profiles *store.ProfileStore) *TerminalService {
	return &TerminalService{profiles: profiles}
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

// Start opens an SSM terminal session and returns a TerminalSession.
func (svc *TerminalService) Start(ctx context.Context, profileID, instanceID string) (*TerminalSession, error) {
	profile, err := svc.profiles.GetByID(ctx, profileID)
	if err != nil {
		return nil, fmt.Errorf("get profile: %w", err)
	}

	client := &awsclient.Client{
		AccessKeyID:     profile.AccessKeyID,
		SecretAccessKey: profile.SecretAccessKey,
		Region:          profile.Region,
	}

	ssmSess, err := client.StartSession(ctx, instanceID)
	if err != nil {
		return nil, err
	}

	sessionJSON, err := json.Marshal(map[string]string{
		"SessionId":  ssmSess.SessionId,
		"StreamUrl":  ssmSess.StreamUrl,
		"TokenValue": ssmSess.TokenValue,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal session response: %w", err)
	}

	paramsJSON, err := json.Marshal(map[string]string{
		"Target": instanceID,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal session params: %w", err)
	}

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

	ptm, err := pty.Start(cmd)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("start session-manager-plugin in pty: %w", err)
	}

	return &TerminalSession{ptm: ptm, cmd: cmd, cancel: cancel}, nil
}

package vault

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"

	"github.com/go-webauthn/webauthn/webauthn"
)

type Method string

const (
	MethodPassword Method = "password"
	MethodPasskey  Method = "passkey"
)

type passwordMeta struct {
	Salt         []byte `json:"salt"`
	EncryptedKey []byte `json:"encryptedKey"` // MK encrypted with Argon2id-derived key
}

type passkeyMeta struct {
	UserID       []byte          `json:"userId"`
	Credential   json.RawMessage `json:"credential"`   // full webauthn.Credential (preserves Flags, Authenticator, etc.)
	EncryptedKey []byte          `json:"encryptedKey"` // MK encrypted with a stored wrapping key
	WrappingKey  []byte          `json:"wrappingKey"`  // wrapping key (stored; security via WebAuthn auth)
}

type meta struct {
	Version        int           `json:"version"`
	Method         Method        `json:"method"`
	Password       *passwordMeta `json:"password,omitempty"`
	Passkey        *passkeyMeta  `json:"passkey,omitempty"`
	BackupPassword *passwordMeta `json:"backupPassword,omitempty"` // optional backup for passkey mode
}

type Vault struct {
	mu          sync.RWMutex
	masterKey   []byte
	m           *meta
	path        string
	wa          *webauthn.WebAuthn
	regSession  *webauthn.SessionData
	authSession *webauthn.SessionData
	waUser      *vaultUser
}

// vaultUser implements webauthn.User.
type vaultUser struct {
	id          []byte
	credentials []webauthn.Credential
}

func (u *vaultUser) WebAuthnID() []byte                         { return u.id }
func (u *vaultUser) WebAuthnName() string                       { return "sesm-user" }
func (u *vaultUser) WebAuthnDisplayName() string                { return "SESM User" }
func (u *vaultUser) WebAuthnCredentials() []webauthn.Credential { return u.credentials }

func New(path string, port string) (*Vault, error) {
	origin := "http://localhost:" + port
	wa, err := webauthn.New(&webauthn.Config{
		RPDisplayName: "SESM",
		RPID:          "localhost",
		RPOrigins:     []string{origin},
	})
	if err != nil {
		return nil, fmt.Errorf("webauthn init: %w", err)
	}
	v := &Vault{path: path, wa: wa}
	if err := v.load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("load vault: %w", err)
	}
	return v, nil
}

func (v *Vault) load() error {
	data, err := os.ReadFile(v.path)
	if err != nil {
		return err
	}
	var m meta
	if err := json.Unmarshal(data, &m); err != nil {
		return fmt.Errorf("parse vault: %w", err)
	}
	v.m = &m
	return nil
}

func (v *Vault) save() error {
	data, err := json.Marshal(v.m)
	if err != nil {
		return fmt.Errorf("marshal vault: %w", err)
	}
	tmp := v.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("write vault: %w", err)
	}
	return os.Rename(tmp, v.path)
}

// IsInitialized reports whether the vault has been set up.
func (v *Vault) IsInitialized() bool {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return v.m != nil
}

// Method returns the configured unlock method, or "" if not initialized.
func (v *Vault) Method() Method {
	v.mu.RLock()
	defer v.mu.RUnlock()
	if v.m == nil {
		return ""
	}
	return v.m.Method
}

// IsUnlocked reports whether the vault has been unlocked.
func (v *Vault) IsUnlocked() bool {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return len(v.masterKey) == keyLen
}

// Encrypt encrypts plaintext with the master key.
func (v *Vault) Encrypt(plaintext []byte) ([]byte, error) {
	v.mu.RLock()
	defer v.mu.RUnlock()
	if len(v.masterKey) != keyLen {
		return nil, errors.New("vault locked")
	}
	return encryptGCM(v.masterKey, plaintext)
}

// Decrypt decrypts ciphertext with the master key.
func (v *Vault) Decrypt(ciphertext []byte) ([]byte, error) {
	v.mu.RLock()
	defer v.mu.RUnlock()
	if len(v.masterKey) != keyLen {
		return nil, errors.New("vault locked")
	}
	return decryptGCM(v.masterKey, ciphertext)
}

// SetupPassword initialises the vault with password-based encryption.
func (v *Vault) SetupPassword(password string) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	salt, err := generateRandom(saltLen)
	if err != nil {
		return err
	}
	mk, err := generateRandom(keyLen)
	if err != nil {
		return err
	}
	wk := deriveKey(password, salt)
	encMK, err := encryptGCM(wk, mk)
	if err != nil {
		return err
	}

	v.m = &meta{
		Version: 1,
		Method:  MethodPassword,
		Password: &passwordMeta{
			Salt:         salt,
			EncryptedKey: encMK,
		},
	}
	v.masterKey = mk
	return v.save()
}

// UnlockPassword unlocks the vault using a password (primary or backup).
func (v *Vault) UnlockPassword(password string) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if v.m == nil {
		return errors.New("vault not initialized")
	}

	// Try primary password
	if v.m.Method == MethodPassword && v.m.Password != nil {
		wk := deriveKey(password, v.m.Password.Salt)
		mk, err := decryptGCM(wk, v.m.Password.EncryptedKey)
		if err == nil {
			v.masterKey = mk
			return nil
		}
	}

	// Try backup password (available when primary is passkey)
	if v.m.BackupPassword != nil {
		wk := deriveKey(password, v.m.BackupPassword.Salt)
		mk, err := decryptGCM(wk, v.m.BackupPassword.EncryptedKey)
		if err == nil {
			v.masterKey = mk
			return nil
		}
	}

	return errors.New("incorrect password")
}

// HasPasswordBackup reports whether a backup password is configured.
func (v *Vault) HasPasswordBackup() bool {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return v.m != nil && v.m.BackupPassword != nil
}

// AddPasswordBackup encrypts the master key with a backup password and stores it.
// Requires the vault to be unlocked.
func (v *Vault) AddPasswordBackup(password string) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if len(v.masterKey) != keyLen {
		return errors.New("vault locked")
	}
	salt, err := generateRandom(saltLen)
	if err != nil {
		return err
	}
	wk := deriveKey(password, salt)
	encMK, err := encryptGCM(wk, v.masterKey)
	if err != nil {
		return err
	}
	v.m.BackupPassword = &passwordMeta{Salt: salt, EncryptedKey: encMK}
	return v.save()
}

// RemovePasswordBackup removes the backup password.
func (v *Vault) RemovePasswordBackup() error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if v.m == nil {
		return errors.New("vault not initialized")
	}
	v.m.BackupPassword = nil
	return v.save()
}

// BeginReconfigurePasskey starts a new WebAuthn registration to replace the stored credential.
// Requires the vault to be unlocked.
func (v *Vault) BeginReconfigurePasskey() (interface{}, error) {
	v.mu.Lock()
	defer v.mu.Unlock()

	if len(v.masterKey) != keyLen {
		return nil, errors.New("vault locked")
	}
	if v.m == nil || v.m.Method != MethodPasskey {
		return nil, errors.New("vault not configured for passkey")
	}

	user := &vaultUser{id: v.m.Passkey.UserID}
	v.waUser = user

	options, session, err := v.wa.BeginRegistration(user)
	if err != nil {
		return nil, fmt.Errorf("begin registration: %w", err)
	}
	v.regSession = session
	return options, nil
}

// FinalizeReconfigurePasskey replaces the stored passkey credential with the new one.
// Re-encrypts the existing master key for the new credential.
func (v *Vault) FinalizeReconfigurePasskey(cred *webauthn.Credential) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if len(v.masterKey) != keyLen {
		return errors.New("vault locked")
	}

	wk, err := generateRandom(keyLen)
	if err != nil {
		return err
	}
	encMK, err := encryptGCM(wk, v.masterKey)
	if err != nil {
		return err
	}
	credJSON, err := json.Marshal(cred)
	if err != nil {
		return fmt.Errorf("marshal credential: %w", err)
	}

	v.m.Passkey = &passkeyMeta{
		UserID:       v.m.Passkey.UserID,
		Credential:   credJSON,
		EncryptedKey: encMK,
		WrappingKey:  wk,
	}
	return v.save()
}

// BeginPasskeySetup starts WebAuthn registration. Returns JSON-serializable options.
func (v *Vault) BeginPasskeySetup() (interface{}, error) {
	v.mu.Lock()
	defer v.mu.Unlock()

	userID, err := generateRandom(16)
	if err != nil {
		return nil, err
	}
	user := &vaultUser{id: userID}
	v.waUser = user

	options, session, err := v.wa.BeginRegistration(user)
	if err != nil {
		return nil, fmt.Errorf("begin registration: %w", err)
	}
	v.regSession = session
	return options, nil
}

// BeginPasskeyUnlock starts WebAuthn authentication.
func (v *Vault) BeginPasskeyUnlock() (interface{}, error) {
	v.mu.Lock()
	defer v.mu.Unlock()

	if v.m == nil || v.m.Method != MethodPasskey || v.m.Passkey == nil {
		return nil, errors.New("vault not set up with passkey")
	}

	var cred webauthn.Credential
	if err := json.Unmarshal(v.m.Passkey.Credential, &cred); err != nil {
		return nil, fmt.Errorf("deserialize credential: %w", err)
	}
	user := &vaultUser{
		id:          v.m.Passkey.UserID,
		credentials: []webauthn.Credential{cred},
	}
	v.waUser = user

	options, session, err := v.wa.BeginLogin(user)
	if err != nil {
		return nil, fmt.Errorf("begin login: %w", err)
	}
	v.authSession = session
	return options, nil
}

// WAInstance returns the webauthn.WebAuthn instance (used by handlers).
func (v *Vault) WAInstance() *webauthn.WebAuthn { return v.wa }

// RegSession returns and clears the pending registration session.
func (v *Vault) RegSession() *webauthn.SessionData {
	v.mu.Lock()
	defer v.mu.Unlock()
	s := v.regSession
	v.regSession = nil
	return s
}

// AuthSession returns and clears the pending auth session.
func (v *Vault) AuthSession() *webauthn.SessionData {
	v.mu.Lock()
	defer v.mu.Unlock()
	s := v.authSession
	v.authSession = nil
	return s
}

// WAUser returns the current vault user for WebAuthn operations.
func (v *Vault) WAUser() *vaultUser { return v.waUser }

// FinalizePasskeySetup stores the credential and sets up the vault.
func (v *Vault) FinalizePasskeySetup(cred *webauthn.Credential) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	mk, err := generateRandom(keyLen)
	if err != nil {
		return err
	}
	// Wrapping key stored alongside — security is via WebAuthn auth, not key derivation
	wk, err := generateRandom(keyLen)
	if err != nil {
		return err
	}
	encMK, err := encryptGCM(wk, mk)
	if err != nil {
		return err
	}

	credJSON, err := json.Marshal(cred)
	if err != nil {
		return fmt.Errorf("marshal credential: %w", err)
	}

	v.m = &meta{
		Version: 1,
		Method:  MethodPasskey,
		Passkey: &passkeyMeta{
			UserID:       v.waUser.id,
			Credential:   credJSON,
			EncryptedKey: encMK,
			WrappingKey:  wk,
		},
	}
	v.masterKey = mk
	return v.save()
}

// FinalizePasskeyUnlock unlocks the vault after successful WebAuthn auth.
func (v *Vault) FinalizePasskeyUnlock() error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if v.m == nil || v.m.Method != MethodPasskey || v.m.Passkey == nil {
		return errors.New("vault not configured for passkey")
	}
	mk, err := decryptGCM(v.m.Passkey.WrappingKey, v.m.Passkey.EncryptedKey)
	if err != nil {
		return fmt.Errorf("decrypt master key: %w", err)
	}
	v.masterKey = mk
	return nil
}

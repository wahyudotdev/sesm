package config

import (
	"fmt"

	"github.com/jmoiron/sqlx"
)

// migrate applies all schema changes idempotently.
// Add new statements at the end — never modify existing ones.
func migrate(db *sqlx.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS profiles (
			id               TEXT PRIMARY KEY,
			name             TEXT NOT NULL UNIQUE,
			region           TEXT NOT NULL,
			access_key_id    TEXT NOT NULL,
			secret_access_key TEXT NOT NULL,
			account_id       TEXT NOT NULL DEFAULT '',
			created_at       DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
			updated_at       DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id            TEXT PRIMARY KEY,
			profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
			profile_name  TEXT NOT NULL,
			instance_id   TEXT NOT NULL,
			instance_name TEXT NOT NULL DEFAULT '',
			type          TEXT NOT NULL CHECK(type IN ('terminal','port-forward')),
			status        TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','terminated','failed')),
			local_port    INTEGER,
			remote_port   INTEGER,
			remote_host   TEXT,
			started_at    DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
			ended_at      DATETIME
		)`,
	}

	for i, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("migration %d: %w", i, err)
		}
	}

	return nil
}

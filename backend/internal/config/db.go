package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/jmoiron/sqlx"
	_ "modernc.org/sqlite" // SQLite driver (no CGO)
)

// OpenDB opens (or creates) the SQLite database file and runs migrations.
func OpenDB() (*sqlx.DB, error) {
	path := dbPath()

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, fmt.Errorf("create db dir: %w", err)
	}

	db, err := sqlx.Open("sqlite", path+"?_journal_mode=WAL&_foreign_keys=on&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	db.SetMaxOpenConns(1) // SQLite is single-writer

	if err = migrate(db); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return db, nil
}

func dbPath() string {
	if p := os.Getenv("DB_PATH"); p != "" {
		return p
	}

	home, _ := os.UserHomeDir()

	return filepath.Join(home, ".sesm", "sesm.db")
}

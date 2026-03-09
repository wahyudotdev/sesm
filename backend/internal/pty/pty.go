package pty

import "io"

// PTY is the interface for a platform pseudo-terminal.
// Implementations must be safe for concurrent reads and writes.
type PTY interface {
	io.ReadWriteCloser
	// Resize adjusts the terminal dimensions.
	Resize(rows, cols uint16) error
	// Wait blocks until the underlying process exits.
	Wait() error
}

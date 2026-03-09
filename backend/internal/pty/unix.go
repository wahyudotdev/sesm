//go:build darwin || linux

package pty

import (
	"os"
	"os/exec"
)

// unixPTY wraps the master *os.File into the PTY interface.
type unixPTY struct {
	master *os.File
	cmd    *exec.Cmd
}

func (p *unixPTY) Read(b []byte) (int, error)  { return p.master.Read(b) }
func (p *unixPTY) Write(b []byte) (int, error) { return p.master.Write(b) }
func (p *unixPTY) Close() error                { return p.master.Close() }
func (p *unixPTY) Resize(rows, cols uint16) error {
	return Setsize(p.master, rows, cols)
}
func (p *unixPTY) Wait() error { return p.cmd.Wait() }

// New starts cmd in a PTY and returns the PTY interface.
func New(cmd *exec.Cmd) (PTY, error) {
	master, err := Start(cmd)
	if err != nil {
		return nil, err
	}
	return &unixPTY{master: master, cmd: cmd}, nil
}

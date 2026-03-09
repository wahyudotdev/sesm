//go:build linux

package pty

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
	"unsafe"
)

const tiocgptn uintptr = 0x80045430
const tiocsptlck uintptr = 0x40045431
const tiocswinsz uintptr = 0x5414

type Winsize struct{ Rows, Cols, Xpixel, Ypixel uint16 }

// open opens /dev/ptmx and returns (master, slave, error).
// Gets slave name via TIOCGPTN ioctl.
func open() (*os.File, *os.File, error) {
	ptm, err := os.OpenFile("/dev/ptmx", os.O_RDWR, 0)
	if err != nil {
		return nil, nil, err
	}

	// Get PTY number.
	var ptn uint32
	if _, _, errno := syscall.Syscall(syscall.SYS_IOCTL, ptm.Fd(), tiocgptn, uintptr(unsafe.Pointer(&ptn))); errno != 0 {
		ptm.Close()
		return nil, nil, errno
	}

	// Unlock the slave PTY.
	var unlock int32 = 0
	if _, _, errno := syscall.Syscall(syscall.SYS_IOCTL, ptm.Fd(), tiocsptlck, uintptr(unsafe.Pointer(&unlock))); errno != 0 {
		ptm.Close()
		return nil, nil, errno
	}

	slaveName := fmt.Sprintf("/dev/pts/%d", ptn)
	pts, err := os.OpenFile(slaveName, os.O_RDWR|syscall.O_NOCTTY, 0)
	if err != nil {
		ptm.Close()
		return nil, nil, err
	}

	return ptm, pts, nil
}

// Open opens a PTY pair and returns (master, slave).
func Open() (*os.File, *os.File, error) {
	return open()
}

// Start runs cmd in a new PTY session. Returns the master fd.
func Start(cmd *exec.Cmd) (*os.File, error) {
	ptm, pts, err := open()
	if err != nil {
		return nil, err
	}
	defer pts.Close()
	cmd.Stdin, cmd.Stdout, cmd.Stderr = pts, pts, pts
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.Setsid = true
	cmd.SysProcAttr.Setctty = true
	// Ctty is the fd number in the child process. Since pts is assigned to
	// stdin (fd 0), the child sees the controlling terminal at fd 0.
	cmd.SysProcAttr.Ctty = 0
	if err := cmd.Start(); err != nil {
		_ = ptm.Close()
		return nil, err
	}
	return ptm, nil
}

// Setsize resizes the PTY.
func Setsize(ptm *os.File, rows, cols uint16) error {
	ws := Winsize{Rows: rows, Cols: cols}
	_, _, errno := syscall.Syscall(syscall.SYS_IOCTL, ptm.Fd(), tiocswinsz, uintptr(unsafe.Pointer(&ws)))
	if errno != 0 {
		return fmt.Errorf("TIOCSWINSZ: %w", errno)
	}
	return nil
}

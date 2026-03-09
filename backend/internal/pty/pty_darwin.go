//go:build darwin

package pty

/*
#include <stdlib.h>
#include <fcntl.h>
#include <unistd.h>

// openAndGrantPty opens /dev/ptmx, calls grantpt+unlockpt, and returns
// the master fd and the slave device name via ptsname.
// Returns -1 on error and sets errno.
static int openMaster(char **slaveName) {
	int master = posix_openpt(O_RDWR | O_NOCTTY);
	if (master < 0) return -1;
	if (grantpt(master) < 0)  { close(master); return -1; }
	if (unlockpt(master) < 0) { close(master); return -1; }
	*slaveName = ptsname(master);
	return master;
}
*/
import "C"

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
	"unsafe"
)

const tiocswinsz uintptr = 0x80087467

type Winsize struct{ Rows, Cols, Xpixel, Ypixel uint16 }

// open opens a PTY master via posix_openpt+grantpt+unlockpt and returns (master, slave).
func open() (*os.File, *os.File, error) {
	var slaveName *C.char
	masterFd, err := C.openMaster(&slaveName)
	if masterFd < 0 {
		return nil, nil, fmt.Errorf("openMaster: %w", err)
	}

	ptm := os.NewFile(uintptr(masterFd), "/dev/ptmx")
	slaveNameGo := C.GoString(slaveName)

	pts, err := os.OpenFile(slaveNameGo, os.O_RDWR|syscall.O_NOCTTY, 0)
	if err != nil {
		_ = ptm.Close()
		return nil, nil, fmt.Errorf("open slave pty %s: %w", slaveNameGo, err)
	}

	return ptm, pts, nil
}

var _ = unsafe.Sizeof(0) // keep unsafe imported for Winsize usage in Setsize

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

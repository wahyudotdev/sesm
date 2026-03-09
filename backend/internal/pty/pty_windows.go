//go:build windows

package pty

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Winsize mirrors the Unix struct for API compatibility.
type Winsize struct{ Rows, Cols, Xpixel, Ypixel uint16 }

// winPTY implements PTY using the Windows ConPTY API (CreatePseudoConsole).
//
// Data flow:
//
//	caller writes keystrokes → inWrite → [pipe] → inRead  → ConPTY → child stdin
//	child stdout             → ConPTY  → outWrite → [pipe] → outRead → caller reads
type winPTY struct {
	console  windows.Handle
	inWrite  *os.File
	outRead  *os.File
	procInfo windows.ProcessInformation
	once     sync.Once
}

func (p *winPTY) Read(b []byte) (int, error)  { return p.outRead.Read(b) }
func (p *winPTY) Write(b []byte) (int, error) { return p.inWrite.Write(b) }

func (p *winPTY) Close() error {
	var firstErr error
	p.once.Do(func() {
		if p.procInfo.Process != 0 {
			_ = windows.TerminateProcess(p.procInfo.Process, 1)
			_, _ = windows.WaitForSingleObject(p.procInfo.Process, windows.INFINITE)
			_ = windows.CloseHandle(p.procInfo.Process)
			_ = windows.CloseHandle(p.procInfo.Thread)
		}
		windows.ClosePseudoConsole(p.console)
		for _, f := range []*os.File{p.inWrite, p.outRead} {
			if f != nil {
				if err := f.Close(); err != nil && firstErr == nil {
					firstErr = err
				}
			}
		}
	})
	return firstErr
}

func (p *winPTY) Resize(rows, cols uint16) error {
	return windows.ResizePseudoConsole(p.console, windows.Coord{X: int16(cols), Y: int16(rows)})
}

// Wait blocks until the child process exits. Called by the service monitor goroutine.
func (p *winPTY) Wait() error {
	if p.procInfo.Process == 0 {
		return nil
	}
	_, err := windows.WaitForSingleObject(p.procInfo.Process, windows.INFINITE)
	return err
}

// New starts cmd attached to a ConPTY and returns a PTY.
// On Windows, exec.Cmd is not Start()ed; its Args and Env are used to launch
// the process directly via CreateProcess with EXTENDED_STARTUPINFO_PRESENT so
// that the ConPTY attribute can be attached.
func New(cmd *exec.Cmd) (PTY, error) {
	// Pipe 1: caller writes keystrokes → ConPTY reads (child stdin)
	inRead, inWrite, err := os.Pipe()
	if err != nil {
		return nil, fmt.Errorf("create input pipe: %w", err)
	}
	// Pipe 2: ConPTY writes output → caller reads (child stdout/stderr)
	outRead, outWrite, err := os.Pipe()
	if err != nil {
		_ = inRead.Close()
		_ = inWrite.Close()
		return nil, fmt.Errorf("create output pipe: %w", err)
	}

	var console windows.Handle
	if err = windows.CreatePseudoConsole(
		windows.Coord{X: 220, Y: 50},
		windows.Handle(inRead.Fd()),
		windows.Handle(outWrite.Fd()),
		0,
		&console,
	); err != nil {
		_ = inRead.Close()
		_ = inWrite.Close()
		_ = outRead.Close()
		_ = outWrite.Close()
		return nil, fmt.Errorf("CreatePseudoConsole: %w", err)
	}

	attrList, err := windows.NewProcThreadAttributeList(1)
	if err != nil {
		windows.ClosePseudoConsole(console)
		_ = inRead.Close()
		_ = inWrite.Close()
		_ = outRead.Close()
		_ = outWrite.Close()
		return nil, fmt.Errorf("NewProcThreadAttributeList: %w", err)
	}
	if err = attrList.Update(
		windows.PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE,
		unsafe.Pointer(console),
		unsafe.Sizeof(console),
	); err != nil {
		windows.ClosePseudoConsole(console)
		_ = inRead.Close()
		_ = inWrite.Close()
		_ = outRead.Close()
		_ = outWrite.Close()
		return nil, fmt.Errorf("UpdateProcThreadAttribute: %w", err)
	}

	siEx := &windows.StartupInfoEx{}
	siEx.Cb = uint32(unsafe.Sizeof(*siEx))
	siEx.ProcThreadAttributeList = attrList.List()

	cmdLine, err := windows.UTF16PtrFromString(buildCmdLine(cmd.Args))
	if err != nil {
		windows.ClosePseudoConsole(console)
		_ = inRead.Close()
		_ = inWrite.Close()
		_ = outRead.Close()
		_ = outWrite.Close()
		return nil, fmt.Errorf("UTF16PtrFromString: %w", err)
	}

	var envBlock *uint16
	if len(cmd.Env) > 0 {
		envBlock = buildEnvBlock(cmd.Env)
	}

	var procInfo windows.ProcessInformation
	if err = windows.CreateProcess(
		nil,
		cmdLine,
		nil,
		nil,
		false,
		windows.EXTENDED_STARTUPINFO_PRESENT|windows.CREATE_UNICODE_ENVIRONMENT,
		envBlock,
		nil,
		&siEx.StartupInfo,
		&procInfo,
	); err != nil {
		windows.ClosePseudoConsole(console)
		_ = inRead.Close()
		_ = inWrite.Close()
		_ = outRead.Close()
		_ = outWrite.Close()
		return nil, fmt.Errorf("CreateProcess: %w", err)
	}

	// The ConPTY has inherited the child ends; close our copies.
	_ = inRead.Close()
	_ = outWrite.Close()

	return &winPTY{
		console:  console,
		inWrite:  inWrite,
		outRead:  outRead,
		procInfo: procInfo,
	}, nil
}

// buildCmdLine escapes and joins argv into a Windows command-line string.
func buildCmdLine(argv []string) string {
	parts := make([]string, len(argv))
	for i, a := range argv {
		parts[i] = windows.EscapeArg(a)
	}
	return strings.Join(parts, " ")
}

// buildEnvBlock converts a []string of "KEY=VALUE" pairs into the UTF-16
// double-null-terminated block that CreateProcess expects.
// utf16PtrFromString cannot be used here because the block contains embedded
// null characters between entries.
func buildEnvBlock(env []string) *uint16 {
	var buf []uint16
	for _, e := range env {
		for _, r := range e {
			buf = append(buf, uint16(r))
		}
		buf = append(buf, 0) // null terminator for this entry
	}
	buf = append(buf, 0) // final null terminator for the block
	return &buf[0]
}

// Setsize is unused on Windows; call PTY.Resize instead.
func Setsize(_ *os.File, _, _ uint16) error {
	return fmt.Errorf("Setsize: use PTY.Resize on Windows")
}

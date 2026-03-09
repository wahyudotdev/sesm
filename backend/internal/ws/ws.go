package ws

import (
	"bufio"
	"crypto/sha1"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
)

// Opcode constants per RFC 6455.
const (
	OpContinuation byte = 0x0
	OpText         byte = 0x1
	OpBinary       byte = 0x2
	OpClose        byte = 0x8
	OpPing         byte = 0x9
	OpPong         byte = 0xA
)

// ErrConnClosed is returned when the remote peer sends a close frame.
var ErrConnClosed = errors.New("websocket: connection closed")

// Conn wraps a hijacked HTTP connection for WebSocket communication.
type Conn struct {
	conn net.Conn
	br   *bufio.Reader
}

// Upgrade validates the WebSocket handshake, hijacks the connection, and
// returns a *Conn ready for message I/O.
func Upgrade(w http.ResponseWriter, r *http.Request) (*Conn, error) {
	if !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
		return nil, fmt.Errorf("websocket: missing Upgrade: websocket header")
	}

	key := r.Header.Get("Sec-WebSocket-Key")
	if key == "" {
		return nil, fmt.Errorf("websocket: missing Sec-WebSocket-Key header")
	}

	// Compute accept key per RFC 6455 §4.2.2.
	const magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
	h := sha1.New()
	h.Write([]byte(key + magic))
	accept := base64.StdEncoding.EncodeToString(h.Sum(nil))

	hj, ok := w.(http.Hijacker)
	if !ok {
		return nil, fmt.Errorf("websocket: server does not support hijacking")
	}

	conn, brw, err := hj.Hijack()
	if err != nil {
		return nil, fmt.Errorf("websocket: hijack: %w", err)
	}

	// Write 101 Switching Protocols response.
	resp := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Accept: " + accept + "\r\n" +
		"\r\n"
	if _, err = conn.Write([]byte(resp)); err != nil {
		conn.Close()
		return nil, fmt.Errorf("websocket: write handshake: %w", err)
	}

	return &Conn{conn: conn, br: brw.Reader}, nil
}

// ReadMessage reads a single WebSocket frame from the client.
// It handles masking, auto-responds to pings, and returns ErrConnClosed on
// a close frame.
func (c *Conn) ReadMessage() (opcode byte, payload []byte, err error) {
	for {
		// Read first two bytes: FIN+opcode, MASK+payload length.
		header := make([]byte, 2)
		if _, err = io.ReadFull(c.br, header); err != nil {
			return 0, nil, err
		}

		// fin := (header[0] & 0x80) != 0  // not used currently
		op := header[0] & 0x0F
		masked := (header[1] & 0x80) != 0
		payLen := int64(header[1] & 0x7F)

		switch payLen {
		case 126:
			ext := make([]byte, 2)
			if _, err = io.ReadFull(c.br, ext); err != nil {
				return 0, nil, err
			}
			payLen = int64(ext[0])<<8 | int64(ext[1])
		case 127:
			ext := make([]byte, 8)
			if _, err = io.ReadFull(c.br, ext); err != nil {
				return 0, nil, err
			}
			payLen = 0
			for i := 0; i < 8; i++ {
				payLen = payLen<<8 | int64(ext[i])
			}
		}

		// Read masking key.
		var maskKey [4]byte
		if masked {
			if _, err = io.ReadFull(c.br, maskKey[:]); err != nil {
				return 0, nil, err
			}
		}

		// Read payload.
		data := make([]byte, payLen)
		if _, err = io.ReadFull(c.br, data); err != nil {
			return 0, nil, err
		}

		// Unmask.
		if masked {
			for i := range data {
				data[i] ^= maskKey[i%4]
			}
		}

		switch op {
		case OpPing:
			// Auto-pong.
			_ = c.WriteMessage(OpPong, data)
			continue
		case OpClose:
			// Send close frame back and signal closure.
			_ = c.WriteMessage(OpClose, nil)
			c.conn.Close()
			return OpClose, nil, ErrConnClosed
		default:
			return op, data, nil
		}
	}
}

// WriteMessage writes a single unmasked server WebSocket frame.
func (c *Conn) WriteMessage(opcode byte, payload []byte) error {
	length := len(payload)
	var header []byte

	// First byte: FIN bit set + opcode.
	b0 := byte(0x80) | opcode

	if length <= 125 {
		header = []byte{b0, byte(length)}
	} else if length <= 65535 {
		header = []byte{
			b0, 126,
			byte(length >> 8), byte(length),
		}
	} else {
		header = []byte{
			b0, 127,
			0, 0, 0, 0,
			byte(length >> 24), byte(length >> 16), byte(length >> 8), byte(length),
		}
	}

	buf := make([]byte, len(header)+length)
	copy(buf, header)
	copy(buf[len(header):], payload)

	_, err := c.conn.Write(buf)
	return err
}

// Close closes the underlying network connection.
func (c *Conn) Close() error {
	return c.conn.Close()
}

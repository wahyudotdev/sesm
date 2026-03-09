package handler

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"

	"sesm/internal/service"
	"sesm/internal/ws"
)

// TerminalHandler manages WebSocket terminal sessions.
type TerminalHandler struct {
	svc *service.SessionService
}

// NewTerminalHandler creates a TerminalHandler.
func NewTerminalHandler(svc *service.SessionService) *TerminalHandler {
	return &TerminalHandler{svc: svc}
}

type resizeMsg struct {
	Type string `json:"type"`
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

// Connect upgrades an HTTP request to a WebSocket and proxies terminal I/O.
func (h *TerminalHandler) Connect(w http.ResponseWriter, r *http.Request) {
	profileID := r.URL.Query().Get("profileId")
	instanceID := r.URL.Query().Get("instanceId")
	instanceName := r.URL.Query().Get("instanceName")

	if profileID == "" || instanceID == "" {
		fail(w, http.StatusBadRequest, "profileId and instanceId query parameters are required")
		return
	}

	conn, err := ws.Upgrade(w, r)
	if err != nil {
		log.Printf("websocket upgrade: %v", err)
		return
	}
	defer conn.Close()

	sessionID, ptm, err := h.svc.StartTerminal(r.Context(), profileID, instanceID, instanceName)
	if err != nil {
		data, _ := json.Marshal(map[string]string{"type": "error", "message": err.Error()})
		_ = conn.WriteMessage(ws.OpText, data)
		return
	}
	defer func() {
		_ = h.svc.Terminate(context.Background(), sessionID)
	}()

	// session → WebSocket
	outDone := make(chan struct{})
	go func() {
		defer close(outDone)
		buf := make([]byte, 32*1024)
		for {
			n, err := ptm.Read(buf)
			if n > 0 {
				if werr := conn.WriteMessage(ws.OpBinary, buf[:n]); werr != nil {
					return
				}
			}
			if err != nil {
				if err != io.EOF {
					log.Printf("terminal read: %v", err)
				}
				return
			}
		}
	}()

	// WebSocket → session
	for {
		opcode, data, err := conn.ReadMessage()
		if err != nil {
			break
		}

		switch opcode {
		case ws.OpText:
			var ctrl resizeMsg
			if json.Unmarshal(data, &ctrl) == nil && ctrl.Type == "resize" && ctrl.Cols > 0 && ctrl.Rows > 0 {
				_ = service.Setsize(ptm, ctrl.Rows, ctrl.Cols)
			}
		case ws.OpBinary:
			if _, werr := ptm.Write(data); werr != nil {
				log.Printf("terminal write: %v", werr)
				return
			}
		}
	}

	<-outDone
}

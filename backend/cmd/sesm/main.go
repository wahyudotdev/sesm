package main

import (
	"bufio"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"sesm/internal/handler"
	"sesm/internal/middleware"
	"sesm/internal/service"
	"sesm/internal/store"
	"sesm/internal/vault"
)

//go:embed web/dist
var staticFiles embed.FS

func main() {
	requirePlugin()

	dir := dataDir()

	// Resolve port before initializing vault (WebAuthn needs the origin with port).
	port := os.Getenv("PORT")
	if port == "" {
		port = resolvePort("11200")
	}

	v, err := vault.New(filepath.Join(dir, "vault.json"), port)
	if err != nil {
		log.Fatal(err)
	}

	profileStore := store.NewProfileStore(dir, v)
	instanceStore := store.NewInstanceStore(dir, v)
	sessionStore := store.NewSessionStore(dir, v)
	ruleStore := store.NewRuleStore(dir, v)
	statsStore := store.NewStatsStore(profileStore, sessionStore)
	sessionSvc := service.NewSessionService(profileStore, sessionStore, ruleStore)

	profileH := handler.NewProfileHandler(profileStore)
	statsH := handler.NewStatsHandler(statsStore)
	instanceH := handler.NewInstanceHandler(profileStore, instanceStore)
	termH := handler.NewTerminalHandler(sessionSvc)
	sessionH := handler.NewSessionHandler(sessionSvc, sessionStore)
	ruleH := handler.NewRuleHandler(ruleStore, sessionSvc)
	vaultH := handler.NewVaultHandler(v)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", handler.Health)
	mux.HandleFunc("GET /api/stats", statsH.GetStats)
	mux.HandleFunc("GET /api/profiles", profileH.List)
	mux.HandleFunc("POST /api/profiles", profileH.Create)
	mux.HandleFunc("DELETE /api/profiles/{id}", profileH.Delete)
	mux.HandleFunc("GET /api/instances", instanceH.List)
	mux.HandleFunc("POST /api/instances/{id}/alias", instanceH.SetAlias)
	mux.HandleFunc("GET /api/sessions", sessionH.List)
	mux.HandleFunc("POST /api/sessions/port-forward", sessionH.StartPortForward)
	mux.HandleFunc("POST /api/sessions/{id}/terminate", sessionH.Terminate)
	mux.HandleFunc("GET /api/rules", ruleH.List)
	mux.HandleFunc("POST /api/rules", ruleH.Create)
	mux.HandleFunc("PATCH /api/rules/{id}/toggle", ruleH.Toggle)
	mux.HandleFunc("DELETE /api/rules/{id}", ruleH.Delete)
	mux.HandleFunc("GET /api/terminal/ws", termH.Connect)
	// Vault routes
	mux.HandleFunc("GET /api/vault/status", vaultH.Status)
	mux.HandleFunc("POST /api/vault/setup/password", vaultH.SetupPassword)
	mux.HandleFunc("POST /api/vault/setup/passkey/begin", vaultH.BeginPasskeySetup)
	mux.HandleFunc("POST /api/vault/setup/passkey/finish", vaultH.FinishPasskeySetup)
	mux.HandleFunc("POST /api/vault/unlock/password", vaultH.UnlockPassword)
	mux.HandleFunc("POST /api/vault/unlock/passkey/begin", vaultH.BeginPasskeyUnlock)
	mux.HandleFunc("POST /api/vault/unlock/passkey/finish", vaultH.FinishPasskeyUnlock)
	mux.HandleFunc("POST /api/vault/backup/password", vaultH.AddPasswordBackup)
	mux.HandleFunc("DELETE /api/vault/backup/password", vaultH.RemovePasswordBackup)
	mux.HandleFunc("POST /api/vault/passkey/reconfigure/begin", vaultH.BeginReconfigurePasskey)
	mux.HandleFunc("POST /api/vault/passkey/reconfigure/finish", vaultH.FinishReconfigurePasskey)
	mux.Handle("/", spaHandler())

	h := middleware.CORS(mux)
	addr := ":" + port
	log.Printf("SESM listening on %s", addr)
	go openBrowser("http://localhost:" + port)
	log.Fatal(http.ListenAndServe(addr, withLogger(h)))
}

func resolvePort(preferred string) string {
	ln, err := net.Listen("tcp", ":"+preferred)
	if err == nil {
		ln.Close()
		return preferred
	}
	ln, err = net.Listen("tcp", ":0")
	if err != nil {
		return preferred
	}
	port := fmt.Sprintf("%d", ln.Addr().(*net.TCPAddr).Port)
	ln.Close()
	return port
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		log.Printf("could not open browser: %v", err)
	}
}

func spaHandler() http.Handler {
	sub, _ := fs.Sub(staticFiles, "web/dist")
	fileServer := http.FileServerFS(sub)
	indexHTML, _ := fs.ReadFile(staticFiles, "web/dist/index.html")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if _, err := fs.Stat(sub, path); err != nil || path == "" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			w.Write(indexHTML)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}

func dataDir() string {
	if d := os.Getenv("SESM_DATA_DIR"); d != "" {
		return d
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".sesm")
}

func withLogger(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rw := &responseWriter{ResponseWriter: w, status: 200}
		h.ServeHTTP(rw, r)
		log.Printf("%d %s %s", rw.status, r.Method, r.URL.Path)
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(status int) {
	rw.status = status
	rw.ResponseWriter.WriteHeader(status)
}

// Hijack delegates to the underlying ResponseWriter so WebSocket upgrades work.
func (rw *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hj, ok := rw.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("underlying ResponseWriter does not support hijacking")
	}
	return hj.Hijack()
}

// requirePlugin checks for session-manager-plugin and prompts the user to install
// it if missing, blocking until they confirm or choose to exit.
func requirePlugin() {
	if err := service.CheckPlugin(); err == nil {
		return
	}

	fmt.Println()
	fmt.Println("┌─────────────────────────────────────────────────────────────────┐")
	fmt.Println("│  SESM requires the AWS Session Manager Plugin                   │")
	fmt.Println("│                                                                  │")
	fmt.Println("│  Install it from:                                                │")
	fmt.Println("│  https://docs.aws.amazon.com/systems-manager/latest/userguide/  │")
	fmt.Println("│  session-manager-working-with-install-plugin.html               │")
	fmt.Println("│                                                                  │")
	fmt.Println("│  macOS (Homebrew):                                               │")
	fmt.Println("│    brew install --cask session-manager-plugin                    │")
	fmt.Println("│                                                                  │")
	fmt.Println("│  After installing, press Enter to retry or Ctrl+C to exit.      │")
	fmt.Println("└─────────────────────────────────────────────────────────────────┘")
	fmt.Println()

	scanner := bufio.NewScanner(os.Stdin)
	for {
		fmt.Print("Press Enter to retry... ")
		scanner.Scan()
		if err := service.CheckPlugin(); err == nil {
			fmt.Println("✓ session-manager-plugin found. Starting SESM...")
			fmt.Println()
			return
		}
		fmt.Println("✖ session-manager-plugin still not found. Install it and try again.")
		fmt.Println()
	}
}

package handler

import "net/http"

// Health returns a liveness response.
func Health(w http.ResponseWriter, r *http.Request) {
	ok(w, map[string]string{"status": "ok"})
}

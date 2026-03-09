# SESM — SSM EC2 Session Manager
# Root Makefile

BINARY        := sesm
BACKEND_DIR   := backend
FRONTEND_DIR  := frontend
FRONTEND_DIST := $(FRONTEND_DIR)/dist
EMBED_DIR     := $(BACKEND_DIR)/cmd/sesm/web/dist
GO            := go
GOLANGCI      := golangci-lint
NPM           := npm

.PHONY: all dev build build-backend build-frontend \
        lint lint-backend lint-frontend \
        fmt fmt-backend fmt-frontend \
        test test-backend \
        clean install-tools help

# ─── Default ───────────────────────────────────────────────────────────────────

all: build

# ─── Development ───────────────────────────────────────────────────────────────

## dev: run backend + frontend in parallel (requires tmux or use 'make dev-backend' / 'make dev-frontend')
dev:
	@echo "Starting backend and frontend dev servers..."
	@trap 'kill 0' SIGINT; \
	  (cd $(BACKEND_DIR) && $(GO) run ./cmd/sesm) & \
	  (cd $(FRONTEND_DIR) && $(NPM) run dev) & \
	  wait

## dev-backend: run backend only (hot-reload requires 'air' installed)
dev-backend:
	cd $(BACKEND_DIR) && $(GO) run ./cmd/sesm

## dev-frontend: run frontend Vite dev server
dev-frontend:
	cd $(FRONTEND_DIR) && $(NPM) run dev

# ─── Build ─────────────────────────────────────────────────────────────────────

## build: build frontend then embed it into the Go binary
build: build-frontend embed build-backend

## build-frontend: compile frontend assets into dist/
build-frontend:
	@echo "Building frontend..."
	cd $(FRONTEND_DIR) && $(NPM) run build

## embed: copy frontend dist into the Go embed directory (backend/cmd/sesm/web/dist/)
embed:
	@echo "Copying frontend dist to $(EMBED_DIR)..."
	@rm -rf $(EMBED_DIR)
	@mkdir -p $(BACKEND_DIR)/cmd/sesm/web
	@cp -r $(FRONTEND_DIST) $(EMBED_DIR)

## build-backend: compile the Go binary (with embedded frontend)
build-backend:
	@echo "Building backend binary..."
	cd $(BACKEND_DIR) && CGO_ENABLED=0 $(GO) build -ldflags="-s -w" -o ../$(BINARY) ./cmd/sesm

## build-backend-dev: build backend without embedded frontend (for backend-only dev)
build-backend-dev:
	cd $(BACKEND_DIR) && CGO_ENABLED=0 $(GO) build -o ../$(BINARY) ./cmd/sesm

# ─── Lint ──────────────────────────────────────────────────────────────────────

## lint: run all linters
lint: lint-backend lint-frontend

## lint-backend: run golangci-lint on backend
lint-backend:
	@echo "Linting backend..."
	cd $(BACKEND_DIR) && $(GOLANGCI) run ./...

## lint-frontend: run ESLint + Prettier check on frontend
lint-frontend:
	@echo "Linting frontend..."
	cd $(FRONTEND_DIR) && $(NPM) run lint && $(NPM) run format:check

## lint-fix: auto-fix lint issues (frontend only; Go requires manual fixes)
lint-fix:
	cd $(FRONTEND_DIR) && $(NPM) run lint:fix && $(NPM) run format

# ─── Formatting ────────────────────────────────────────────────────────────────

## fmt: format all code
fmt: fmt-backend fmt-frontend

## fmt-backend: run gofmt + goimports on backend
fmt-backend:
	@echo "Formatting backend..."
	cd $(BACKEND_DIR) && gofmt -w . && goimports -w .

## fmt-frontend: run prettier on frontend
fmt-frontend:
	cd $(FRONTEND_DIR) && $(NPM) run format

# ─── Type-check ────────────────────────────────────────────────────────────────

## typecheck: run TypeScript type-checking on frontend
typecheck:
	cd $(FRONTEND_DIR) && $(NPM) run typecheck

# ─── Test ──────────────────────────────────────────────────────────────────────

## test: run all tests
test: test-backend

## test-backend: run Go tests
test-backend:
	cd $(BACKEND_DIR) && $(GO) test -race -count=1 ./...

## test-verbose: run Go tests with verbose output
test-verbose:
	cd $(BACKEND_DIR) && $(GO) test -race -count=1 -v ./...

## test-coverage: run Go tests with coverage report
test-coverage:
	cd $(BACKEND_DIR) && $(GO) test -race -count=1 -coverprofile=coverage.out ./... && \
	  $(GO) tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: backend/coverage.html"

# ─── Install ───────────────────────────────────────────────────────────────────

## install: install all dependencies
install: install-backend install-frontend

## install-backend: tidy Go modules
install-backend:
	cd $(BACKEND_DIR) && $(GO) mod tidy

## install-frontend: install npm packages
install-frontend:
	cd $(FRONTEND_DIR) && $(NPM) install

## install-tools: install development tools (golangci-lint, goimports)
install-tools:
	@echo "Installing golangci-lint..."
	curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $$(go env GOPATH)/bin
	@echo "Installing goimports..."
	$(GO) install golang.org/x/tools/cmd/goimports@latest
	@echo "Installing air (hot-reload)..."
	$(GO) install github.com/air-verse/air@latest

# ─── Clean ─────────────────────────────────────────────────────────────────────

## clean: remove build artifacts
clean:
	@echo "Cleaning..."
	rm -f $(BINARY)
	rm -rf $(FRONTEND_DIST)
	rm -rf $(EMBED_DIR)
	rm -f $(BACKEND_DIR)/coverage.out $(BACKEND_DIR)/coverage.html

# ─── Help ──────────────────────────────────────────────────────────────────────

## help: print this help message
help:
	@echo "Usage: make [target]"
	@echo ""
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  /' | column -t -s ':'

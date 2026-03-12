# SESM — SSM EC2 Session Manager

A lightweight desktop GUI for AWS Systems Manager (SSM) sessions. SESM wraps the
`session-manager-plugin` and your local AWS profiles into a single self-contained
binary that opens directly in your browser.

## Features

- **Dashboard** — at-a-glance stats: total profiles, instances, and active port-forward rules
- **AWS Profiles** — manage multiple named AWS credential profiles in one place
- **EC2 Instance browser** — list instances across regions with names resolved from AWS Name tags
- **Interactive terminal** — full xterm.js terminal over WebSocket (PTY-backed)
- **Port forwarding** — start and stop SSM port-forward sessions with a click
- **Vault encryption** — all data encrypted at rest; unlock with a password or passkey (WebAuthn/FIDO2)
- **Security settings** — reconfigure your passkey or add/remove a backup password at any time
- **Zero runtime dependencies** — the React frontend is embedded in the binary

## Requirements

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) configured with at least one profile
- [AWS Session Manager Plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)

```bash
# macOS (Homebrew)
brew install --cask session-manager-plugin
```

## Installation

### Pre-built binaries

Download the latest release for your platform from the [Releases](https://github.com/wahyudotdev/sesm/releases) page.

| Platform      | Binary                              |
|---------------|-------------------------------------|
| macOS (Apple Silicon) | `sesm_<version>_darwin_arm64.tar.gz` |
| macOS (Intel)         | `sesm_<version>_darwin_amd64.tar.gz` |
| Linux amd64           | `sesm_<version>_linux_amd64.tar.gz`  |
| Linux arm64           | `sesm_<version>_linux_arm64.tar.gz`  |
| Windows amd64         | `sesm_<version>_windows_amd64.zip`   |

Extract and place the binary somewhere on your `$PATH`:

```bash
tar -xzf sesm_*.tar.gz
sudo mv sesm /usr/local/bin/
```

### Build from source

**Prerequisites:** Go 1.21+, Node 18+, npm

```bash
git clone https://github.com/wahyudotdev/sesm.git
cd sesm
make build        # builds frontend, embeds it, and compiles the binary
./sesm
```

## Usage

```bash
sesm
```

SESM starts a local HTTP server (default port `11200`) and opens your browser automatically.
If port `11200` is already in use it picks a random free port.

You can override the port and data directory via environment variables:

| Variable        | Default              | Description                          |
|-----------------|----------------------|--------------------------------------|
| `PORT`          | `11200`              | HTTP listen port                     |
| `SESM_DATA_DIR` | `~/.sesm`            | Directory where profiles/sessions are stored |

## Development

```bash
# Install dependencies
make install

# Run backend + frontend dev servers concurrently
make dev

# Or run them separately
make dev-backend    # Go server on :11200 (hot-reload requires `air`)
make dev-frontend   # Vite dev server on :5173

# Lint & format
make lint
make fmt

# Tests
make test
```

## Changelog

### v0.1.1

- Reboot EC2 instance feature — reboot instances directly from the UI

### v0.1.0

- Vault encryption at rest — protect credentials with a password or passkey (WebAuthn/FIDO2)
- EC2 instance names resolved from AWS Name tags
- Dashboard live stats: total profiles, instances, active port-forward rules
- Security page — reconfigure passkey or manage a backup password
- Terminal and port-forward fixed after vault setup (transparent migration)

### v0.0.3

- UX improvements across instance browser and port-forwarding
- Fixed frontend CI build in GoReleaser

### v0.0.2 — v0.0.1

- Initial release with SSM terminal sessions and port-forwarding
- Multi-profile AWS credential management
- Cross-platform builds (macOS, Linux, Windows)

## Architecture

```
sesm/
├── backend/
│   ├── cmd/sesm/       # main package + embedded frontend (web/dist/)
│   └── internal/
│       ├── aws/        # EC2 and SSM API wrappers
│       ├── handler/    # HTTP handlers
│       ├── pty/        # PTY implementation (CGO on macOS, pure-Go elsewhere)
│       ├── service/    # session business logic
│       └── store/      # JSON file-based persistence
└── frontend/           # React + TypeScript + Vite + xterm.js
```

The frontend is compiled with `npm run build`, copied into `backend/cmd/sesm/web/dist/`, and
embedded into the binary via Go's `embed` package. The result is a single binary that serves
both the API and the SPA.

## Releasing

Releases are created automatically by [GoReleaser](https://goreleaser.com/) when a tag is pushed:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The GitHub Actions workflow builds binaries for macOS (arm64/amd64), Linux (arm64/amd64),
and Windows (amd64), then publishes a GitHub Release with archives and a checksum file.

## License

MIT

# AGENTS.md — SESM Project Coding Rules

**SESM** (SSM EC2 Session Manager) is a desktop-grade web app that lets users configure AWS SSM credentials and use them to open EC2 terminals or set up port-forwarding sessions.

## Project Structure

```
sesm/
├── backend/
│   ├── cmd/sesm/           # main entry point
│   ├── internal/
│   │   ├── config/         # app configuration (env, DB)
│   │   ├── handler/        # HTTP handlers (Fiber route handlers)
│   │   ├── middleware/      # Fiber middleware
│   │   ├── model/          # DB models and domain types
│   │   ├── repository/     # data access layer (SQLite)
│   │   └── service/        # business logic
│   ├── pkg/
│   │   └── awsutil/        # AWS SSM/EC2 helpers
│   ├── web/                # embedded frontend (go:embed target)
│   ├── go.mod
│   └── .golangci.yml
├── frontend/
│   ├── src/
│   │   ├── components/     # reusable UI components
│   │   ├── pages/          # route-level page components
│   │   ├── hooks/          # custom React hooks
│   │   ├── api/            # API client functions
│   │   ├── store/          # global state (Zustand or similar)
│   │   └── types/          # shared TypeScript types
│   ├── public/
│   ├── dist/               # build output (gitignored)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── eslint.config.js
├── AGENTS.md
└── Makefile
```

---

## Backend Rules (Go + Fiber + SQLite)

### Stack

- **Language**: Go 1.21+
- **Web framework**: [github.com/gofiber/fiber/v2](https://github.com/gofiber/fiber)
- **Database**: SQLite via `modernc.org/sqlite` (no-CGO, pure Go)
- **ORM/Query**: raw `database/sql` or [github.com/jmoiron/sqlx](https://github.com/jmoiron/sqlx)
- **Linter**: `golangci-lint` (config at `backend/.golangci.yml`)

### Architecture

- Follow **clean architecture**: handler → service → repository.
- Handlers must NOT contain business logic. They only parse input, call service, and return response.
- Services must NOT import `github.com/gofiber/fiber`. They are framework-agnostic.
- Repositories must NOT contain business logic. They only perform CRUD via SQL.
- Use dependency injection via constructors — no global singletons.

### Coding Standards

1. **No unused imports or variables** — code must compile cleanly.
2. **Error handling**: always return errors, never swallow them with `_`. Use `fmt.Errorf("context: %w", err)` for wrapping.
3. **No naked returns** — always return named values explicitly.
4. **Naming**:
   - Exported types/functions: `PascalCase`
   - Unexported: `camelCase`
   - Constants: `UPPER_SNAKE_CASE` only for truly global/env constants; prefer `camelCase` for package-local
   - Files: `snake_case.go`
5. **Structs**: define request/response structs in the handler package; domain models in `model/`.
6. **Context**: always propagate `context.Context` as first argument for DB and AWS calls.
7. **No init() functions** unless absolutely unavoidable.
8. **Configuration**: load from environment variables only. Use a config struct initialized at startup.
9. **HTTP responses**: use consistent JSON shape:
   ```json
   { "data": ..., "error": null }
   { "data": null, "error": "message" }
   ```
10. **Database migrations**: use versioned SQL files in `internal/config/migrations/`. Apply at startup.
11. **No global `db` variable** — pass DB through dependency injection.
12. **AWS calls**: all SSM/EC2 calls go through `pkg/awsutil`. Never call AWS SDK directly from handlers or services.
13. **Testing**: unit tests in `_test.go` files alongside the package being tested. Use `testify/assert`.

### File Header Convention

Every new `.go` file must begin with a package declaration and a single-line comment if the file's purpose is not obvious from the name:

```go
package handler

// sessions.go handles CRUD for SSM session configurations.
```

### Embed Frontend

The built frontend is embedded using:

```go
//go:embed web/dist
var staticFiles embed.FS
```

Place this in `backend/cmd/sesm/main.go` (or a dedicated `web.go` file in `cmd/sesm/`).
The embedded path `web/dist` is **relative to the Go source file**, so the build step must copy
`frontend/dist/` to `backend/cmd/sesm/web/dist/` before compiling.
Fiber serves the static files via the `filesystem` middleware.

---

## Frontend Rules (React + Vite + TypeScript)

### Stack

- **Language**: TypeScript (strict mode)
- **Framework**: React 18+
- **Build tool**: Vite
- **Linter**: ESLint with `@typescript-eslint` + `eslint-plugin-react`
- **Formatter**: Prettier
- **HTTP client**: `fetch` or `axios` (one choice, commit to it)
- **State**: Zustand for global state; `useState`/`useReducer` for local

### Coding Standards

1. **Strict TypeScript**: `"strict": true` in `tsconfig.json`. No `any` — use `unknown` and narrow.
2. **No implicit any** — every function parameter and return type must be typed.
3. **Component rules**:
   - Functional components only — no class components.
   - One component per file.
   - File name matches the exported component name: `SessionCard.tsx` exports `SessionCard`.
4. **Naming**:
   - Components: `PascalCase`
   - Hooks: `useXxx`
   - Files: `PascalCase.tsx` for components, `camelCase.ts` for non-component files
   - CSS modules: `ComponentName.module.css`
5. **No inline styles** — use CSS modules or a utility-first CSS framework.
6. **Imports**:
   - Use absolute imports configured in `vite.config.ts` + `tsconfig.json` (e.g., `@/components/...`).
   - No relative `../../` imports beyond one level up.
7. **API layer**: all API calls live in `src/api/`. No `fetch` calls inside components or hooks directly.
8. **Error handling**: API errors must be surfaced to the user. Never silently catch and discard.
9. **No `console.log`** in committed code. Use a logger utility if needed.
10. **Accessibility**: use semantic HTML elements. Interactive elements must be keyboard-navigable.
11. **No default exports from non-component files** (e.g., `api/`, `store/`, `hooks/` use named exports).
12. **React Query or SWR**: if server state is needed beyond simple fetch, use React Query. Don't replicate its functionality manually.

### Component Structure Template

```tsx
// SessionCard.tsx
import type { FC } from 'react';
import styles from './SessionCard.module.css';

interface SessionCardProps {
  sessionId: string;
  instanceId: string;
  onConnect: (sessionId: string) => void;
}

export const SessionCard: FC<SessionCardProps> = ({ sessionId, instanceId, onConnect }) => {
  return (
    <div className={styles.card}>
      {/* content */}
    </div>
  );
};
```

---

## Makefile Rules

All project operations go through the `Makefile` at the repo root. Never instruct CI or other developers to run raw commands — always add a Makefile target first.

Key targets: `dev`, `build`, `lint`, `test`, `clean`.

---

## Git Rules

- Branch naming: `feat/<short-desc>`, `fix/<short-desc>`, `chore/<short-desc>`
- Commit messages: imperative mood, max 72 chars subject line
  - `feat: add SSM profile switcher`
  - `fix: handle empty instance list from EC2 describe`
- Never commit: `.env`, `frontend/dist/`, `backend/web/dist/`, SQLite DB files, AWS credential files
- `.gitignore` must cover all of the above

---

## Security Rules

- Never log AWS credentials or session tokens — not even partially.
- Never store plaintext AWS secret keys in SQLite. Use OS keychain or encrypted fields.
- Input from the browser (instance IDs, profile names) must be validated/sanitized before being passed to `exec.Command` or AWS SDK calls to prevent command injection.
- No CORS wildcard (`*`) in production builds. Scope it to the embedded frontend origin.

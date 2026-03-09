import { Bell, Search, RefreshCw } from 'lucide-react'

import type { FC } from 'react'

interface HeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export const Header: FC<HeaderProps> = ({ title, description, actions }) => (
  <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]/80 backdrop-blur-sm">
    {/* Page title */}
    <div className="flex flex-col justify-center min-w-0">
      <h1 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{title}</h1>
      {description && (
        <p className="text-xs text-[var(--color-text-muted)] truncate">{description}</p>
      )}
    </div>

    {/* Right side */}
    <div className="flex items-center gap-2 shrink-0">
      {actions}

      {/* Search shortcut */}
      <button
        type="button"
        aria-label="Search"
        className="flex items-center gap-2 h-8 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border)] transition-colors text-xs"
      >
        <Search size={12} />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden sm:inline text-[10px] px-1 py-0.5 rounded bg-[var(--color-bg-muted)] border border-[var(--color-border)] font-mono">
          ⌘K
        </kbd>
      </button>

      {/* Refresh */}
      <button
        type="button"
        aria-label="Refresh"
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <RefreshCw size={13} />
      </button>

      {/* Notifications */}
      <button
        type="button"
        aria-label="Notifications"
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors relative"
      >
        <Bell size={13} />
      </button>
    </div>
  </header>
)

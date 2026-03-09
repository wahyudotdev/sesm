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
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </header>
)

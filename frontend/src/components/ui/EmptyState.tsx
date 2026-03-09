import type { FC, ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export const EmptyState: FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="w-12 h-12 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] mb-4">
      {icon}
    </div>
    <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{title}</h3>
    {description && (
      <p className="text-xs text-[var(--color-text-muted)] max-w-xs">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
)

import type { FC, ReactNode } from 'react'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'brand'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  dot?: boolean
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-[var(--color-success-muted)] text-[var(--color-success)] border-[var(--color-success)]/20',
  warning: 'bg-[var(--color-warning-muted)] text-[var(--color-warning)] border-[var(--color-warning)]/20',
  danger: 'bg-[var(--color-danger-muted)] text-[var(--color-danger)] border-[var(--color-danger)]/20',
  info: 'bg-[var(--color-info-muted)] text-[var(--color-info)] border-[var(--color-info)]/20',
  brand: 'bg-[var(--color-brand-muted)] text-[var(--color-brand)] border-[var(--color-brand)]/20',
  default: 'bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
}

const dotColors: Record<BadgeVariant, string> = {
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
  info: 'bg-[var(--color-info)]',
  brand: 'bg-[var(--color-brand)]',
  default: 'bg-[var(--color-text-muted)]',
}

export const Badge: FC<BadgeProps> = ({ variant = 'default', children, dot = false }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${variantStyles[variant]}`}
  >
    {dot && (
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} shrink-0`} />
    )}
    {children}
  </span>
)

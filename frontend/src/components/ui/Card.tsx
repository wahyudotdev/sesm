import type { FC, ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg' | 'none'
  hover?: boolean
}

const paddingMap = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' }

export const Card: FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  hover = false,
}) => (
  <div
    className={`
      bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl
      ${paddingMap[padding]}
      ${hover ? 'transition-colors hover:border-[var(--color-border)]/80 hover:bg-[var(--color-bg-elevated)] cursor-pointer' : ''}
      ${className}
    `}
  >
    {children}
  </div>
)

interface CardHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export const CardHeader: FC<CardHeaderProps> = ({ title, description, actions }) => (
  <div className="flex items-start justify-between mb-5">
    <div>
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      {description && (
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{description}</p>
      )}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
)

import type { FC } from 'react'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }

export const Spinner: FC<SpinnerProps> = ({ size = 'md', className = '' }) => (
  <div
    role="status"
    aria-label="Loading"
    className={`${sizeMap[size]} border-2 border-[var(--color-border)] border-t-[var(--color-brand)] rounded-full animate-spin ${className}`}
  />
)

import type { FC, ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white shadow-sm shadow-[var(--color-brand)]/20',
  secondary:
    'bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-muted)] text-[var(--color-text-primary)] border border-[var(--color-border)]',
  ghost:
    'bg-transparent hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
  danger:
    'bg-[var(--color-danger-muted)] hover:bg-[var(--color-danger)]/20 text-[var(--color-danger)] border border-[var(--color-danger)]/20',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
}

export const Button: FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => (
  <button
    className={`
      inline-flex items-center justify-center font-medium rounded-lg
      transition-all duration-150 select-none
      disabled:opacity-50 disabled:cursor-not-allowed
      focus-visible:outline-2 focus-visible:outline-[var(--color-brand)] focus-visible:outline-offset-2
      ${variantStyles[variant]}
      ${sizeStyles[size]}
      ${className}
    `}
    disabled={disabled ?? loading}
    {...props}
  >
    {loading ? (
      <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
    ) : (
      icon
    )}
    {children}
  </button>
)

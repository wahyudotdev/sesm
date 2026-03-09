import type { FC, InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string
  error?: string
  hint?: string
  prefix?: ReactNode
  suffix?: ReactNode
}

export const Input: FC<InputProps> = ({
  label,
  error,
  hint,
  prefix,
  suffix,
  className = '',
  id,
  ...props
}) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-[var(--color-text-secondary)]">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-[var(--color-text-muted)]">{prefix}</span>
        )}
        <input
          id={inputId}
          className={`
            w-full h-9 rounded-lg text-sm bg-[var(--color-bg-elevated)]
            border ${error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'}
            text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
            ${prefix ? 'pl-9' : 'pl-3'} ${suffix ? 'pr-9' : 'pr-3'}
            focus:outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]/30
            transition-colors
            ${className}
          `}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-[var(--color-text-muted)]">{suffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  )
}

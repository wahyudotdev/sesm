import type { FC, SelectHTMLAttributes } from 'react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: SelectOption[]
  error?: string
  placeholder?: string
}

export const Select: FC<SelectProps> = ({
  label,
  options,
  error,
  placeholder,
  className = '',
  id,
  ...props
}) => {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-medium text-[var(--color-text-secondary)]">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`
          w-full h-9 px-3 rounded-lg text-sm bg-[var(--color-bg-elevated)]
          border ${error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'}
          text-[var(--color-text-primary)]
          focus:outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]/30
          transition-colors cursor-pointer
          ${className}
        `}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}

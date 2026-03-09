import { Construction } from 'lucide-react'

import type { FC } from 'react'

interface PlaceholderProps {
  title: string
  description: string
}

export const Placeholder: FC<PlaceholderProps> = ({ title, description }) => (
  <div className="max-w-6xl mx-auto">
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] mb-5">
        <Construction size={22} />
      </div>
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">{title}</h2>
      <p className="text-sm text-[var(--color-text-muted)] max-w-sm">{description}</p>
    </div>
  </div>
)

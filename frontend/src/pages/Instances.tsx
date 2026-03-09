import { Server, Terminal, ArrowRightLeft, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'

import type { FC } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import type { Instance } from '@/types'

const instanceStateVariant = (state: Instance['state']) => {
  const map = { running: 'success', offline: 'default' } as const
  return map[state]
}

export const Instances: FC = () => {
  const [search, setSearch] = useState('')
  const [selectedProfile, _setSelectedProfile] = useState<string>('')

  const instances: Instance[] = [] // TODO: wire to API

  const filtered = instances.filter(
    (i) =>
      i.instanceId.includes(search) ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.privateIp.includes(search),
  )

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Filters bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="Filter instances…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<Search size={13} />}
          />
        </div>
        <Button variant="secondary" size="md" icon={<RefreshCw size={13} />}>
          Refresh
        </Button>
      </div>

      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <CardHeader
            title="EC2 Instances"
            description={selectedProfile ? `Showing instances for selected profile` : 'Select a profile to list instances'}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Server size={18} />}
            title="No instances found"
            description="Select an AWS profile to discover EC2 instances with SSM agent running."
          />
        ) : (
          <>
            <div className="flex items-center gap-4 px-5 py-2.5 border-b border-[var(--color-border-subtle)]">
              <div className="w-9 shrink-0" />
              <div className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Instance</div>
              <div className="w-32 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Type</div>
              <div className="w-32 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">IP Address</div>
              <div className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">State</div>
              <div className="w-36 shrink-0" />
            </div>
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {filtered.map((instance) => (
                <div key={instance.instanceId} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-bg-elevated)]/40 transition-colors group">
                  <div className="w-9 h-9 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                    <Server size={14} className="text-[var(--color-text-muted)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{instance.name || instance.instanceId}</p>
                    <p className="text-xs text-[var(--color-text-muted)] font-mono">{instance.instanceId}</p>
                  </div>
                  <span className="w-32 shrink-0 text-xs font-mono text-[var(--color-text-secondary)]">{instance.type}</span>
                  <span className="w-32 shrink-0 text-xs font-mono text-[var(--color-text-secondary)]">{instance.privateIp}</span>
                  <div className="w-24 shrink-0">
                    <Badge variant={instanceStateVariant(instance.state)} dot>{instance.state}</Badge>
                  </div>
                  <div className="w-36 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                    <Button variant="primary" size="sm" icon={<Terminal size={12} />}>Terminal</Button>
                    <Button variant="secondary" size="sm" icon={<ArrowRightLeft size={12} />} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

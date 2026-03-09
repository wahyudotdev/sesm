import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Server, Terminal, ArrowRightLeft, RefreshCw, Search, Edit2, Check, X } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import type { FC } from 'react'

import { instancesApi } from '@/api/instances'
import { profilesApi } from '@/api/profiles'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import type { Instance } from '@/types'

const instanceStateVariant = (state: Instance['state']) => {
  const map = { running: 'success', offline: 'default' } as const
  return map[state]
}

const AliasEditor: FC<{ instance: Instance; onSave: (alias: string) => void }> = ({ instance, onSave }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(instance.alias ?? '')

  if (!isEditing) {
    return (
      <div className="group/alias flex items-center gap-2 max-w-[200px]">
        <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
          {instance.alias || instance.name || instance.instanceId}
        </span>
        <button
          onClick={() => {
            setValue(instance.alias ?? '')
            setIsEditing(true)
          }}
          className="opacity-0 group-hover/alias:opacity-100 p-1 hover:bg-[var(--color-bg-elevated)] rounded transition-all text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          <Edit2 size={12} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        className="w-32 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--color-brand)]"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(value)
          if (e.key === 'Escape') setIsEditing(false)
        }}
      />
      <button
        onClick={() => {
          onSave(value)
          setIsEditing(false)
        }}
        className="p-1 hover:bg-green-500/10 text-green-500 rounded transition-colors"
      >
        <Check size={12} />
      </button>
      <button
        onClick={() => setIsEditing(false)}
        className="p-1 hover:bg-red-500/10 text-red-500 rounded transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  )
}

export const Instances: FC = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState<string>('all')

  // Fetch profiles
  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: profilesApi.list,
  })

  // Fetch instances for all profiles if 'all' is selected
  const {
    data: instancesMap = {},
    isLoading: isLoadingInstances,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['instances', selectedProfileId, profiles.length],
    queryFn: async () => {
      if (selectedProfileId === 'all') {
        const all: Record<string, (Instance & { profileName: string; profileId: string })[]> = {}
        await Promise.all(
          profiles.map(async (p) => {
            try {
              const res = await instancesApi.list(p.id)
              all[p.id] = res.map((i) => ({ ...i, profileName: p.name, profileId: p.id }))
            } catch (e) {
              console.error(`Failed to fetch instances for profile ${p.name}:`, e)
              all[p.id] = []
            }
          }),
        )
        return all
      }
      const p = profiles.find((prof) => prof.id === selectedProfileId)
      if (!p) return {}
      const res = await instancesApi.list(selectedProfileId)
      return {
        [selectedProfileId]: res.map((i) => ({ ...i, profileName: p.name, profileId: p.id })),
      }
    },
    enabled: profiles.length > 0,
  })

  const instances = useMemo(() => {
    return Object.values(instancesMap).flat()
  }, [instancesMap])

  const setAliasMutation = useMutation({
    mutationFn: ({ instanceId, alias }: { instanceId: string; alias: string }) =>
      instancesApi.setAlias(instanceId, alias),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['instances'] })
    },
  })

  const profileOptions = useMemo(
    () => [
      { value: 'all', label: 'All Profiles' },
      ...profiles.map((p) => ({ value: p.id, label: `${p.name} (${p.region})` })),
    ],
    [profiles],
  )

  const filtered = instances.filter(
    (i) =>
      i.instanceId.includes(search) ||
      (i.name && i.name.toLowerCase().includes(search.toLowerCase())) ||
      (i.alias && i.alias.toLowerCase().includes(search.toLowerCase())) ||
      i.privateIp.includes(search) ||
      i.profileName.toLowerCase().includes(search.toLowerCase()),
  )

  const handleConnect = (instance: Instance & { profileId: string }) => {
    navigate(`/terminal?profileId=${instance.profileId}&instanceId=${instance.instanceId}`)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Filters bar */}
      <div className="flex items-center gap-3">
        <div className="w-64">
          <Select
            placeholder="Select Profile"
            options={profileOptions}
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
          />
        </div>
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="Filter instances…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<Search size={13} />}
          />
        </div>
        <Button
          variant="secondary"
          size="md"
          icon={<RefreshCw size={13} className={isRefetching ? 'animate-spin' : ''} />}
          onClick={() => void refetch()}
          disabled={profiles.length === 0 || isLoadingInstances}
        >
          Refresh
        </Button>
      </div>

      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <CardHeader
            title="EC2 Instances"
            description={
              selectedProfileId === 'all'
                ? `Showing ${instances.length} instances across ${profiles.length} profiles`
                : `Showing ${instances.length} instances for the selected profile`
            }
          />
        </div>

        {isLoadingInstances || isLoadingProfiles ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : profiles.length === 0 ? (
          <EmptyState
            icon={<Server size={18} />}
            title="No profiles configured"
            description="Add an AWS profile in the Profiles page to discover EC2 instances."
            action={
              <Button variant="primary" size="sm" onClick={() => navigate('/profiles')}>
                Go to Profiles
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Server size={18} />}
            title={search ? 'No matching instances' : 'No instances found'}
            description={
              search
                ? 'Try adjusting your search filters.'
                : 'No SSM-managed instances were found.'
            }
          />
        ) : (
          <>
            <div className="flex items-center gap-4 px-5 py-2.5 border-b border-[var(--color-border-subtle)]">
              <div className="w-9 shrink-0" />
              <div className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Instance
              </div>
              <div className="w-40 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Profile
              </div>
              <div className="w-32 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Type
              </div>
              <div className="w-32 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                IP Address
              </div>
              <div className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                State
              </div>
              <div className="w-36 shrink-0" />
            </div>
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {filtered.map((instance) => (
                <div
                  key={`${instance.profileId}-${instance.instanceId}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-bg-elevated)]/40 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                    <Server size={14} className="text-[var(--color-text-muted)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <AliasEditor
                      instance={instance}
                      onSave={(alias) =>
                        setAliasMutation.mutate({ instanceId: instance.instanceId, alias })
                      }
                    />
                    <p className="text-xs text-[var(--color-text-muted)] font-mono">
                      {instance.instanceId}
                      {instance.alias && (
                        <span className="ml-2 text-[var(--color-text-muted)] opacity-60">
                          ({instance.name})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="w-40 shrink-0 flex flex-col min-w-0">
                    <span className="text-xs font-medium text-[var(--color-text-secondary)] truncate">
                      {instance.profileName}
                    </span>
                  </div>
                  <span className="w-32 shrink-0 text-xs font-mono text-[var(--color-text-secondary)]">
                    {instance.type}
                  </span>
                  <span className="w-32 shrink-0 text-xs font-mono text-[var(--color-text-secondary)]">
                    {instance.privateIp}
                  </span>
                  <div className="w-20 shrink-0">
                    <Badge variant={instanceStateVariant(instance.state)} dot>
                      {instance.state}
                    </Badge>
                  </div>
                  <div className="w-36 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Terminal size={12} />}
                      onClick={() => handleConnect(instance)}
                      disabled={instance.state !== 'running'}
                    >
                      Terminal
                    </Button>
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

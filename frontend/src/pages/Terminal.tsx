import { useQuery } from '@tanstack/react-query'
import {
  Terminal as TerminalIcon,
  Server,
  KeyRound,
  Wifi,
  WifiOff,
  X,
  ChevronDown,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { useState, useCallback } from 'react'

import type { FC } from 'react'
import type { TerminalStatus } from '@/components/terminal/XTerm'

import { instancesApi } from '@/api/instances'
import { profilesApi } from '@/api/profiles'
import { XTerm } from '@/components/terminal/XTerm'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { Instance, Profile } from '@/types'

const buildWsUrl = (profileId: string, instanceId: string): string => {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/api/terminal/ws?profileId=${encodeURIComponent(profileId)}&instanceId=${encodeURIComponent(instanceId)}`
}

// ─── Profile Selector ────────────────────────────────────────────────────────

const ProfileSelector: FC<{
  profiles: Profile[]
  selected: string
  onSelect: (id: string) => void
  loading: boolean
}> = ({ profiles, selected, onSelect, loading }) => {
  const [open, setOpen] = useState(false)
  const current = profiles.find((p) => p.id === selected)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 h-9 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:border-[var(--color-brand)]/40 transition-colors min-w-[200px]"
      >
        <KeyRound size={13} className="text-[var(--color-text-muted)] shrink-0" />
        <span className="flex-1 text-left truncate">
          {loading ? (
            <span className="text-[var(--color-text-muted)]">Loading…</span>
          ) : current ? (
            current.name
          ) : (
            <span className="text-[var(--color-text-muted)]">Select profile</span>
          )}
        </span>
        <ChevronDown size={13} className="text-[var(--color-text-muted)] shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-full min-w-[220px] z-50 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden">
          {profiles.length === 0 ? (
            <div className="px-3 py-3 text-xs text-[var(--color-text-muted)]">No profiles yet</div>
          ) : (
            profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect(p.id)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-[var(--color-bg-muted)] transition-colors
                  ${p.id === selected ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-primary)]'}`}
              >
                <KeyRound size={12} className="shrink-0 opacity-60" />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">{p.region}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Instance Selector ───────────────────────────────────────────────────────

const InstanceSelector: FC<{
  instances: Instance[]
  selected: string
  onSelect: (id: string) => void
  loading: boolean
  disabled: boolean
}> = ({ instances, selected, onSelect, loading, disabled }) => {
  const [open, setOpen] = useState(false)
  const current = instances.find((i) => i.instanceId === selected)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-2.5 h-9 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:border-[var(--color-brand)]/40 transition-colors min-w-[260px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Server size={13} className="text-[var(--color-text-muted)] shrink-0" />
        <span className="flex-1 text-left truncate">
          {loading ? (
            <span className="text-[var(--color-text-muted)] flex items-center gap-2">
              <Spinner size="sm" />
              Fetching instances…
            </span>
          ) : current ? (
            current.name || current.instanceId
          ) : (
            <span className="text-[var(--color-text-muted)]">
              {disabled ? 'Select a profile first' : 'Select instance'}
            </span>
          )}
        </span>
        <ChevronDown size={13} className="text-[var(--color-text-muted)] shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-full min-w-[320px] z-50 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden">
          {instances.length === 0 ? (
            <div className="px-3 py-3 text-xs text-[var(--color-text-muted)]">
              No SSM instances found for this profile
            </div>
          ) : (
            instances.map((inst) => (
              <button
                key={inst.instanceId}
                type="button"
                onClick={() => {
                  onSelect(inst.instanceId)
                  setOpen(false)
                }}
                disabled={inst.state !== 'running'}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-[var(--color-bg-muted)] transition-colors
                  ${inst.instanceId === selected ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-primary)]'}
                  disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Server size={12} className="shrink-0 opacity-60" />
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-medium">{inst.name || inst.instanceId}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{inst.instanceId}</span>
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">{inst.privateIp}</span>
                <Badge variant={inst.state === 'running' ? 'success' : 'default'} dot>
                  {inst.state}
                </Badge>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

interface TermTab {
  id: string
  label: string
  wsUrl: string
  status: TerminalStatus
}

// ─── Terminal Page ────────────────────────────────────────────────────────────

export const Terminal: FC = () => {
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [selectedInstanceId, setSelectedInstanceId] = useState('')
  const [tabs, setTabs] = useState<TermTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: profilesApi.list,
  })

  const { data: instances = [], isLoading: loadingInstances } = useQuery({
    queryKey: ['instances', selectedProfileId],
    queryFn: () => instancesApi.list(selectedProfileId),
    enabled: !!selectedProfileId,
  })
  const safeInstances = instances ?? []

  const handleProfileSelect = (id: string): void => {
    setSelectedProfileId(id)
    setSelectedInstanceId('')
  }

  const handleConnect = (): void => {
    if (!selectedProfileId || !selectedInstanceId) return

    const instance = safeInstances.find((i) => i.instanceId === selectedInstanceId)
    const profile = profiles.find((p) => p.id === selectedProfileId)
    const label = `${instance?.name || selectedInstanceId} (${profile?.name ?? '…'})`
    const wsUrl = buildWsUrl(selectedProfileId, selectedInstanceId)
    const id = `${selectedProfileId}-${selectedInstanceId}-${Date.now()}`

    const tab: TermTab = { id, label, wsUrl, status: 'connecting' }
    setTabs((prev) => [...prev, tab])
    setActiveTabId(id)
  }

  const handleStatusChange = useCallback((tabId: string, status: TerminalStatus): void => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, status } : t)))
  }, [])

  const handleCloseTab = (tabId: string): void => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId)
      if (activeTabId === tabId) {
        setActiveTabId(next.length > 0 ? next[next.length - 1].id : null)
      }
      return next
    })
  }

  const canConnect = !!selectedProfileId && !!selectedInstanceId

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] shrink-0">
        <ProfileSelector
          profiles={profiles ?? []}
          selected={selectedProfileId}
          onSelect={handleProfileSelect}
          loading={loadingProfiles}
        />
        <InstanceSelector
          instances={safeInstances}
          selected={selectedInstanceId}
          onSelect={setSelectedInstanceId}
          loading={loadingInstances && !!selectedProfileId}
          disabled={!selectedProfileId}
        />
        <Button
          variant="primary"
          size="md"
          icon={<TerminalIcon size={13} />}
          disabled={!canConnect}
          onClick={handleConnect}
        >
          Connect
        </Button>
      </div>

      {/* Tab bar */}
      {tabs.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-x-auto shrink-0">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all select-none
                ${activeTabId === tab.id
                  ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]/50'
                }`}
              onClick={() => setActiveTabId(tab.id)}
            >
              {tab.status === 'connecting' && (
                <Loader2 size={11} className="animate-spin text-[var(--color-warning)] shrink-0" />
              )}
              {tab.status === 'connected' && (
                <Wifi size={11} className="text-[var(--color-success)] shrink-0" />
              )}
              {tab.status === 'disconnected' && (
                <WifiOff size={11} className="text-[var(--color-text-muted)] shrink-0" />
              )}
              <span className="max-w-[180px] truncate">{tab.label}</span>
              <button
                type="button"
                aria-label="Close tab"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCloseTab(tab.id)
                }}
                className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--color-bg-muted)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Terminal area */}
      <div className="flex-1 min-h-0 relative">
        {tabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] mb-5">
              <TerminalIcon size={22} />
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
              No sessions open
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] max-w-sm">
              Select a profile and an EC2 instance above, then click{' '}
              <strong className="text-[var(--color-text-secondary)]">Connect</strong> to start an
              SSM terminal session.
            </p>
            {profiles.length === 0 && !loadingProfiles && (
              <div className="mt-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-warning-muted)] border border-[var(--color-warning)]/20 text-xs text-[var(--color-warning)]">
                <AlertCircle size={13} />
                No profiles configured — add one in the{' '}
                <a href="/profiles" className="underline underline-offset-2">
                  Profiles
                </a>{' '}
                page first.
              </div>
            )}
          </div>
        ) : (
          tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 p-3 ${activeTabId === tab.id ? 'flex' : 'hidden'}`}
            >
              <XTerm
                wsUrl={tab.wsUrl}
                active={activeTabId === tab.id}
                onStatusChange={(status) => handleStatusChange(tab.id, status)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

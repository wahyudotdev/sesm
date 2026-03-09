import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  KeyRound,
  Terminal as TerminalIcon,
  Server,
  ArrowRightLeft,
  Clock,
  TrendingUp,
  ChevronRight,
  Zap,
  Megaphone,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import type { FC } from 'react'
import type { Session } from '@/types'

import { instancesApi } from '@/api/instances'
import { profilesApi } from '@/api/profiles'
import { rulesApi } from '@/api/rules'
import { sessionsApi } from '@/api/sessions'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'

const sessionStatusVariant = (status: Session['status']) => {
  const map = { active: 'success', terminated: 'default', failed: 'danger' } as const
  return map[status]
}

const formatRelativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface StatCardProps {
  label: string
  value: number | string
  icon: FC<{ size?: number; className?: string }>
  accent?: string
  trend?: string
  to?: string
}

const StatCard: FC<StatCardProps> = ({ label, value, icon: Icon, accent = 'brand', trend, to }) => {
  const accentMap: Record<string, string> = {
    brand: 'text-[var(--color-brand)] bg-[var(--color-brand-muted)]',
    success: 'text-[var(--color-success)] bg-[var(--color-success-muted)]',
    warning: 'text-[var(--color-warning)] bg-[var(--color-warning-muted)]',
    info: 'text-[var(--color-info)] bg-[var(--color-info-muted)]',
  }
  const content = (
    <Card hover={!!to} className="group">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <span className="text-xs text-[var(--color-text-muted)] font-medium">{label}</span>
          <span className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">
            {value}
          </span>
          {trend && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--color-success)]">
              <TrendingUp size={10} />
              {trend}
            </span>
          )}
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accentMap[accent]}`}>
          <Icon size={16} />
        </div>
      </div>
    </Card>
  )
  if (to) return <Link to={to}>{content}</Link>
  return content
}

const QuickAction: FC<{
  icon: FC<{ size?: number; className?: string }>
  label: string
  description: string
  to: string
  accent?: string
}> = ({ icon: Icon, label, description, to, accent = 'brand' }) => {
  const accentMap: Record<string, string> = {
    brand: 'text-[var(--color-brand)] bg-[var(--color-brand-muted)] group-hover:bg-[var(--color-brand)]/20',
    success: 'text-[var(--color-success)] bg-[var(--color-success-muted)] group-hover:bg-[var(--color-success)]/20',
    info: 'text-[var(--color-info)] bg-[var(--color-info-muted)] group-hover:bg-[var(--color-info)]/20',
    warning: 'text-[var(--color-warning)] bg-[var(--color-warning-muted)] group-hover:bg-[var(--color-warning)]/20',
  }
  return (
    <Link to={to}>
      <Card hover className="group h-full">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${accentMap[accent]}`}
          >
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{description}</p>
          </div>
          <ChevronRight
            size={14}
            className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] shrink-0 transition-colors"
          />
        </div>
      </Card>
    </Link>
  )
}

const CURRENT_VERSION = 'v0.1.0'
const CHANGELOG_KEY = `sesm-changelog-dismissed-${CURRENT_VERSION}`

interface ChangelogEntry {
  version: string
  items: string[]
}

const changelogs: ChangelogEntry[] = [
  {
    version: 'v0.1.0',
    items: [
      'Vault encryption at rest — protect credentials with a password or passkey (WebAuthn/FIDO2)',
      'EC2 instance names resolved from AWS Name tags',
      'Dashboard live stats: total profiles, instances, active port-forward rules',
      'Security page — reconfigure passkey or manage a backup password',
      'Terminal and port-forward fixed after vault setup (transparent migration)',
    ],
  },
  {
    version: 'v0.0.3',
    items: [
      'UX improvements across instance browser and port-forwarding',
      'Fixed frontend CI build in GoReleaser',
    ],
  },
  {
    version: 'v0.0.2 — v0.0.1',
    items: [
      'Initial release with SSM terminal sessions',
      'Port-forwarding with rule management',
      'Multi-profile AWS credential management',
      'Cross-platform builds (macOS, Linux, Windows)',
    ],
  },
]

const ChangelogBanner: FC = () => {
  const [dismissed, setDismissed] = useState(() => {
    try { return !!localStorage.getItem(CHANGELOG_KEY) } catch { return false }
  })

  if (dismissed) return null

  const dismiss = () => {
    try { localStorage.setItem(CHANGELOG_KEY, '1') } catch { /* noop */ }
    setDismissed(true)
  }

  return (
    <div className="rounded-xl border border-[var(--color-brand)]/20 bg-[var(--color-brand-muted)] px-4 py-3 text-xs text-[var(--color-text-primary)]">
      <div className="flex items-start gap-3">
        <Megaphone size={14} className="text-[var(--color-brand)] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-3">
          {changelogs.map((entry, i) => (
            <div key={entry.version}>
              <p className={`font-semibold mb-1 ${i === 0 ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-secondary)]'}`}>
                {i === 0 ? `What's new in ${entry.version}` : entry.version}
              </p>
              <ul className="space-y-1">
                {entry.items.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-[var(--color-text-secondary)]">
                    <span className={`mt-px ${i === 0 ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]'}`}>·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

export const Dashboard: FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats'],
    queryFn: sessionsApi.stats,
    refetchInterval: 30_000,
  })

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: profilesApi.list,
  })

  const { data: instancesMap = {} } = useQuery({
    queryKey: ['instances-dashboard', profiles.length],
    queryFn: async () => {
      const all: Record<string, unknown[]> = {}
      await Promise.all(
        profiles.map(async (p) => {
          try {
            all[p.id] = await instancesApi.list(p.id)
          } catch {
            all[p.id] = []
          }
        }),
      )
      return all
    },
    enabled: profiles.length > 0,
  })

  const totalInstances = Object.values(instancesMap).reduce((sum, arr) => sum + arr.length, 0)

  const { data: rules = [] } = useQuery({
    queryKey: ['rules'],
    queryFn: rulesApi.list,
  })

  const activePortForwards = rules.filter((r) => r.enabled).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="md" />
      </div>
    )
  }

  const stats = data ?? {
    totalProfiles: 0,
    recentSessions: [],
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <ChangelogBanner />

      {/* Alert if API error (backend not running yet) */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-warning-muted)] border border-[var(--color-warning)]/20 text-xs text-[var(--color-warning)]">
          <Zap size={13} className="shrink-0" />
          Backend not reachable.
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Profiles"
          value={stats.totalProfiles}
          icon={KeyRound}
          accent="brand"
          to="/profiles"
        />
        <StatCard
          label="Total Instances"
          value={totalInstances}
          icon={Server}
          accent="info"
          to="/instances"
        />
        <StatCard
          label="Active Port-Forwards"
          value={activePortForwards}
          icon={ArrowRightLeft}
          accent="success"
          to="/port-forward"
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickAction
            icon={Server}
            label="Manage Instances"
            description="View and connect to your EC2/SSM instances"
            to="/instances"
            accent="brand"
          />
          <QuickAction
            icon={ArrowRightLeft}
            label="Port Forward"
            description="Tunnel a remote port to your local machine"
            to="/port-forward"
            accent="info"
          />
          <QuickAction
            icon={KeyRound}
            label="Add Profile"
            description="Configure a new AWS credential profile"
            to="/profiles"
            accent="success"
          />
        </div>
      </div>

      {/* Recent sessions */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <CardHeader
            title="Recent Sessions"
            description="Your last terminal and port-forward sessions"
            actions={
              <Link to="/history">
                <Button variant="ghost" size="sm" icon={<Clock size={12} />}>
                  View all
                </Button>
              </Link>
            }
          />
        </div>

        {stats.recentSessions.length === 0 ? (
          <EmptyState
            icon={<TerminalIcon size={18} />}
            title="No sessions yet"
            description="Connect to an EC2 instance to start your first session."
            action={
              <Link to="/instances">
                <Button variant="primary" size="sm" icon={<Server size={12} />}>
                  Go to Instances
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {stats.recentSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--color-bg-elevated)]/50 transition-colors"
              >
                {/* Type icon */}
                <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                  {session.type === 'terminal' ? (
                    <TerminalIcon size={13} className="text-[var(--color-brand)]" />
                  ) : (
                    <ArrowRightLeft size={13} className="text-[var(--color-info)]" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {session.instanceName || session.instanceId}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">
                    {session.profileName} · {session.instanceId}
                  </p>
                </div>

                {/* Port info */}
                {session.type === 'port-forward' && session.localPort && (
                  <span className="text-xs font-mono text-[var(--color-text-muted)] shrink-0">
                    :{session.localPort} → :{session.remotePort}
                  </span>
                )}

                {/* Time */}
                <span className="text-xs text-[var(--color-text-muted)] shrink-0 tabular-nums">
                  {formatRelativeTime(session.startedAt)}
                </span>

                {/* Status */}
                <Badge variant={sessionStatusVariant(session.status)} dot>
                  {session.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import {
  KeyRound,
  Activity,
  Terminal as TerminalIcon,
  Server,
  ArrowRightLeft,
  Clock,
  TrendingUp,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import type { FC } from 'react'
import type { Session } from '@/types'

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

export const Dashboard: FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats'],
    queryFn: sessionsApi.stats,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="md" />
      </div>
    )
  }

  const stats = data ?? {
    totalProfiles: 0,
    activeSessions: 0,
    totalSessions: 0,
    recentSessions: [],
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Alert if API error (backend not running yet) */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-warning-muted)] border border-[var(--color-warning)]/20 text-xs text-[var(--color-warning)]">
          <Zap size={13} className="shrink-0" />
          Backend not reachable — showing placeholder data. Start the server with{' '}
          <code className="font-mono">make dev-backend</code>.
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Profiles"
          value={stats.totalProfiles}
          icon={KeyRound}
          accent="brand"
          to="/profiles"
        />
        <StatCard
          label="Active Sessions"
          value={stats.activeSessions}
          icon={Activity}
          accent="success"
          to="/history"
        />
        <StatCard
          label="Terminal Sessions"
          value={stats.totalSessions}
          icon={TerminalIcon}
          accent="info"
        />
        <StatCard
          label="Port Forwards"
          value={0}
          icon={ArrowRightLeft}
          accent="warning"
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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, Server, Plus, Trash2, Globe, Shield, RefreshCw } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { FC } from 'react'

import { sessionsApi } from '@/api/sessions'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'

export const PortForward: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    profileId: '',
    instanceId: '',
    instanceName: '',
    localPort: 8080,
    remotePort: 80,
    remoteHost: '',
  })

  // Initialize from search params
  useEffect(() => {
    const profileId = searchParams.get('profileId')
    const instanceId = searchParams.get('instanceId')
    const instanceName = searchParams.get('instanceName')

    if (profileId && instanceId) {
      setForm((f) => ({
        ...f,
        profileId,
        instanceId,
        instanceName: instanceName || instanceId,
      }))
      // Clear params after consuming
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const { data: sessions = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.list,
  })

  const activePortForwards = sessions.filter(
    (s) => s.type === 'port-forward' && s.status === 'active',
  )

  const forwardMutation = useMutation({
    mutationFn: sessionsApi.portForward,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const terminateMutation = useMutation({
    mutationFn: sessionsApi.terminate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const handleStart = () => {
    forwardMutation.mutate(form)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardHeader
          title="New Port Forwarding"
          description="Tunnel a remote port from an EC2 instance to your local machine"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          <Input
            label="Instance ID"
            value={form.instanceId}
            readOnly
            placeholder="Select from Instances page"
            prefix={<Server size={14} />}
          />
          <Input
            label="Instance Name"
            value={form.instanceName}
            readOnly
            placeholder="-"
          />
          <Input
            label="Remote Host (Optional)"
            value={form.remoteHost}
            onChange={(e) => setForm((f) => ({ ...f, remoteHost: e.target.value }))}
            placeholder="e.g. database.cluster.internal"
            prefix={<Globe size={14} />}
          />
          <Input
            label="Local Port"
            type="number"
            value={form.localPort}
            onChange={(e) => setForm((f) => ({ ...f, localPort: parseInt(e.target.value) || 0 }))}
            prefix={<Shield size={14} />}
          />
          <Input
            label="Remote Port"
            type="number"
            value={form.remotePort}
            onChange={(e) => setForm((f) => ({ ...f, remotePort: parseInt(e.target.value) || 0 }))}
            prefix={<Shield size={14} />}
          />
          <div className="flex items-end">
            <Button
              variant="primary"
              className="w-full"
              icon={<Plus size={14} />}
              onClick={handleStart}
              loading={forwardMutation.isPending}
              disabled={!form.instanceId || !form.localPort || !form.remotePort}
            >
              Start Forwarding
            </Button>
          </div>
        </div>
        {!form.instanceId && (
          <p className="mt-3 text-xs text-[var(--color-text-muted)] italic">
            Tip: Go to the Instances page and click the port-forward icon on a running instance to pre-fill this form.
          </p>
        )}
      </Card>

      {/* Active Sessions */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <CardHeader
            title="Active Port Forwards"
            description={`${activePortForwards.length} active tunnels`}
          />
          <Button 
            variant="ghost" 
            size="sm" 
            icon={<RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />} 
            onClick={() => void refetch()}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : activePortForwards.length === 0 ? (
          <EmptyState
            icon={<ArrowRightLeft size={20} />}
            title="No active port forwards"
            description="Start a new forwarding session above to see it listed here."
          />
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {activePortForwards.map((session) => (
              <div key={session.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-bg-elevated)]/30 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-info-muted)] flex items-center justify-center shrink-0">
                  <ArrowRightLeft size={16} className="text-[var(--color-info)]" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {session.instanceName || session.instanceId}
                    </span>
                    <Badge variant="success" dot>active</Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                    {session.profileName} · {session.instanceId}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1 px-4 border-l border-r border-[var(--color-border-subtle)]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[var(--color-text-primary)]">:{session.localPort}</span>
                    <ArrowRightLeft size={10} className="text-[var(--color-text-muted)]" />
                    <span className="text-xs font-mono font-bold text-[var(--color-brand)]">
                      {session.remoteHost ? `${session.remoteHost}:${session.remotePort}` : `:${session.remotePort}`}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Local Transfer</span>
                </div>

                <div className="w-32 shrink-0 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={12} />}
                    onClick={() => terminateMutation.mutate(session.id)}
                    loading={terminateMutation.isPending && terminateMutation.variables === session.id}
                  >
                    Stop
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

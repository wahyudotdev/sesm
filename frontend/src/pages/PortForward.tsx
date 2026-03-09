import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, Server, Plus, Trash2, Globe, Shield, BookMarked } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { FC } from 'react'

import { rulesApi } from '@/api/rules'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import type { PortForwardRule } from '@/types'

// ─── Toggle Switch ────────────────────────────────────────────────────────────

const Toggle: FC<{ checked: boolean; onChange: () => void; disabled?: boolean }> = ({
  checked,
  onChange,
  disabled,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={onChange}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] disabled:opacity-40 disabled:cursor-not-allowed
      ${checked ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-bg-muted)]'}`}
  >
    <span
      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200
        ${checked ? 'translate-x-4' : 'translate-x-0'}`}
    />
  </button>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

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
    ruleName: '',
  })
  const [saveAsRule, setSaveAsRule] = useState(true)

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
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ['rules'],
    queryFn: rulesApi.list,
  })

  const createRuleMutation = useMutation({
    mutationFn: rulesApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rules'] })
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      rulesApi.toggle(id, enabled),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rules'] })
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const deleteRuleMutation = useMutation({
    mutationFn: rulesApi.delete,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rules'] })
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const handleStart = (): void => {
    if (saveAsRule) {
      createRuleMutation.mutate({
        name: form.ruleName || `${form.instanceName || form.instanceId}:${form.remotePort}→${form.localPort}`,
        profileId: form.profileId,
        instanceId: form.instanceId,
        instanceName: form.instanceName,
        localPort: form.localPort,
        remotePort: form.remotePort,
        remoteHost: form.remoteHost,
      })
    }
  }

  const isPending = createRuleMutation.isPending

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
          {saveAsRule && (
            <Input
              label="Rule Name"
              value={form.ruleName}
              onChange={(e) => setForm((f) => ({ ...f, ruleName: e.target.value }))}
              placeholder="e.g. Prod DB tunnel"
              prefix={<BookMarked size={14} />}
            />
          )}
        </div>

        <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <Toggle checked={saveAsRule} onChange={() => setSaveAsRule((v) => !v)} />
            <span className="text-sm text-[var(--color-text-secondary)]">Save as rule</span>
            <span className="text-xs text-[var(--color-text-muted)]">(auto-reconnect on restart)</span>
          </label>
          <Button
            variant="primary"
            icon={<Plus size={14} />}
            onClick={handleStart}
            loading={isPending}
            disabled={!form.instanceId || !form.localPort || !form.remotePort}
          >
            {saveAsRule ? 'Save & Start' : 'Start Forwarding'}
          </Button>
        </div>

        {!form.instanceId && (
          <p className="mt-3 text-xs text-[var(--color-text-muted)] italic">
            Tip: Go to the Instances page and click the port-forward icon on a running instance to pre-fill this form.
          </p>
        )}
      </Card>

      {/* Saved Rules */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <CardHeader
            title="Saved Rules"
            description="Persistent tunnels that reconnect automatically"
          />
        </div>

        {loadingRules ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : rules.length === 0 ? (
          <EmptyState
            icon={<BookMarked size={20} />}
            title="No saved rules"
            description='Enable "Save as rule" when starting a forward to persist it here.'
          />
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {rules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                onToggle={(enabled) => toggleMutation.mutate({ id: rule.id, enabled })}
                onDelete={() => deleteRuleMutation.mutate(rule.id)}
                toggling={toggleMutation.isPending && (toggleMutation.variables as { id: string }).id === rule.id}
                deleting={deleteRuleMutation.isPending && deleteRuleMutation.variables === rule.id}
              />
            ))}
          </div>
        )}
      </Card>

    </div>
  )
}

// ─── Rule Row ─────────────────────────────────────────────────────────────────

const RuleRow: FC<{
  rule: PortForwardRule
  onToggle: (enabled: boolean) => void
  onDelete: () => void
  toggling: boolean
  deleting: boolean
}> = ({ rule, onToggle, onDelete, toggling, deleting }) => (
  <div className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-bg-elevated)]/30 transition-colors group">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors
      ${rule.enabled ? 'bg-[var(--color-brand-muted)]' : 'bg-[var(--color-bg-muted)]'}`}>
      <BookMarked size={16} className={rule.enabled ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]'} />
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{rule.name}</span>
        <Badge variant={rule.enabled ? 'success' : 'default'} dot>
          {rule.enabled ? 'enabled' : 'disabled'}
        </Badge>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
        {rule.instanceName || rule.instanceId}
        {rule.remoteHost ? ` · via ${rule.remoteHost}` : ''}
      </p>
    </div>

    <div className="flex flex-col items-end gap-1 px-4 border-l border-r border-[var(--color-border-subtle)]">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-bold text-[var(--color-text-primary)]">:{rule.localPort}</span>
        <ArrowRightLeft size={10} className="text-[var(--color-text-muted)]" />
        <span className="text-xs font-mono font-bold text-[var(--color-brand)]">
          {rule.remoteHost ? `${rule.remoteHost}:${rule.remotePort}` : `:${rule.remotePort}`}
        </span>
      </div>
      <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Saved Rule</span>
    </div>

    <div className="flex items-center gap-3 shrink-0">
      {toggling ? (
        <Spinner size="sm" />
      ) : (
        <Toggle checked={rule.enabled} onChange={() => onToggle(!rule.enabled)} />
      )}
      <button
        type="button"
        aria-label="Delete rule"
        onClick={onDelete}
        disabled={deleting}
        className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-all disabled:opacity-40"
      >
        {deleting ? <Spinner size="sm" /> : <Trash2 size={13} />}
      </button>
    </div>
  </div>
)

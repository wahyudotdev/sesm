import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, Trash2, MapPin, Hash, Calendar } from 'lucide-react'
import { useState } from 'react'

import type { FC } from 'react'
import type { Profile } from '@/types'

import { profilesApi } from '@/api/profiles'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'eu-north-1', label: 'Europe (Stockholm)' },
  { value: 'sa-east-1', label: 'South America (São Paulo)' },
]

const maskKey = (key: string): string =>
  key.length > 8 ? `${key.slice(0, 4)}${'•'.repeat(8)}${key.slice(-4)}` : '••••••••'

const ProfileRow: FC<{ profile: Profile; onDelete: (id: string) => void; deleting: boolean }> = ({
  profile,
  onDelete,
  deleting,
}) => (
  <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-bg-elevated)]/40 transition-colors group">
    {/* Icon */}
    <div className="w-9 h-9 rounded-xl bg-[var(--color-brand-muted)] flex items-center justify-center shrink-0">
      <KeyRound size={14} className="text-[var(--color-brand)]" />
    </div>

    {/* Profile name */}
    <div className="w-40 shrink-0">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{profile.name}</p>
      {profile.accountId && (
        <p className="text-xs text-[var(--color-text-muted)] font-mono">{profile.accountId}</p>
      )}
    </div>

    {/* Region */}
    <div className="flex items-center gap-1.5 w-48 shrink-0">
      <MapPin size={11} className="text-[var(--color-text-muted)] shrink-0" />
      <span className="text-xs text-[var(--color-text-secondary)]">{profile.region}</span>
    </div>

    {/* Access Key */}
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <Hash size={11} className="text-[var(--color-text-muted)] shrink-0" />
      <span className="text-xs font-mono text-[var(--color-text-muted)] truncate">
        {maskKey(profile.accessKeyId)}
      </span>
    </div>

    {/* Created */}
    <div className="flex items-center gap-1.5 w-28 shrink-0">
      <Calendar size={11} className="text-[var(--color-text-muted)] shrink-0" />
      <span className="text-xs text-[var(--color-text-muted)]">
        {new Date(profile.createdAt).toLocaleDateString()}
      </span>
    </div>

    {/* Status */}
    <div className="w-20 shrink-0">
      <Badge variant="success" dot>
        active
      </Badge>
    </div>

    {/* Actions */}
    <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
      <Button
        variant="danger"
        size="sm"
        icon={<Trash2 size={12} />}
        loading={deleting}
        onClick={() => onDelete(profile.id)}
        aria-label={`Delete profile ${profile.name}`}
      />
    </div>
  </div>
)

interface CreateFormState {
  name: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  accountId: string
}

const initialForm: CreateFormState = {
  name: '',
  region: 'us-east-1',
  accessKeyId: '',
  secretAccessKey: '',
  accountId: '',
}

export const Profiles: FC = () => {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateFormState>(initialForm)

  const { data, isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: profilesApi.list,
  })
  const profiles = data ?? []

  const createMutation = useMutation({
    mutationFn: profilesApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profiles'] })
      setForm(initialForm)
      setShowCreate(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: profilesApi.delete,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })

  const handleCreate = (): void => {
    createMutation.mutate({
      name: form.name,
      region: form.region,
      accessKeyId: form.accessKeyId,
      secretAccessKey: form.secretAccessKey,
      accountId: form.accountId || undefined,
    })
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Create panel */}
      {showCreate && (
        <Card>
          <CardHeader
            title="New Profile"
            description="Add a new AWS credential profile"
            actions={
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Profile Name"
              placeholder="e.g. production"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Select
              label="AWS Region"
              options={AWS_REGIONS}
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
            />
            <Input
              label="Access Key ID"
              placeholder="AKIAIOSFODNN7EXAMPLE"
              value={form.accessKeyId}
              onChange={(e) => setForm((f) => ({ ...f, accessKeyId: e.target.value }))}
            />
            <Input
              label="Secret Access Key"
              type="password"
              placeholder="••••••••••••••••••••••"
              value={form.secretAccessKey}
              onChange={(e) => setForm((f) => ({ ...f, secretAccessKey: e.target.value }))}
            />
            <Input
              label="Account ID (optional)"
              placeholder="123456789012"
              value={form.accountId}
              onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
            />
          </div>

          <div className="flex justify-end mt-5">
            <Button
              variant="primary"
              size="md"
              icon={<Plus size={13} />}
              loading={createMutation.isPending}
              onClick={handleCreate}
              disabled={!form.name || !form.accessKeyId || !form.secretAccessKey}
            >
              Create Profile
            </Button>
          </div>

          {createMutation.error && (
            <p className="mt-3 text-xs text-[var(--color-danger)]">
              {createMutation.error.message}
            </p>
          )}
        </Card>
      )}

      {/* Profiles list */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <CardHeader
            title="AWS Profiles"
            description={`${profiles.length} profile${profiles.length !== 1 ? 's' : ''} configured`}
            actions={
              !showCreate && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={13} />}
                  onClick={() => setShowCreate(true)}
                >
                  Add Profile
                </Button>
              )
            }
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : profiles.length === 0 ? (
          <EmptyState
            icon={<KeyRound size={18} />}
            title="No profiles configured"
            description="Add an AWS credential profile to start connecting to EC2 instances."
            action={
              !showCreate && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={13} />}
                  onClick={() => setShowCreate(true)}
                >
                  Add Profile
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Table header */}
            <div className="flex items-center gap-4 px-5 py-2.5 border-b border-[var(--color-border-subtle)]">
              <div className="w-9 shrink-0" />
              <div className="w-40 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Name</div>
              <div className="w-48 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Region</div>
              <div className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Access Key</div>
              <div className="w-28 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Created</div>
              <div className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Status</div>
              <div className="w-9 shrink-0" />
            </div>
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {profiles.map((profile) => (
                <ProfileRow
                  key={profile.id}
                  profile={profile}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  deleting={deleteMutation.isPending && deleteMutation.variables === profile.id}
                />
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

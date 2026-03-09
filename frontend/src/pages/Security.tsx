import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck,
  Fingerprint,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import type { FC } from 'react'

import { vaultApi } from '@/api/vault'
import type { RegistrationResponseJSON } from '@/api/vault'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

export const Security: FC = () => {
  const qc = useQueryClient()
  const { data: status } = useQuery({
    queryKey: ['vault-status'],
    queryFn: vaultApi.status,
    staleTime: 0,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['vault-status'] })

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Current method */}
      <Card>
        <CardHeader title="Vault method" description="How your data is protected at rest" />
        <div className="mt-4 flex items-center gap-3">
          {status?.method === 'passkey' ? (
            <Fingerprint size={18} className="text-[var(--color-brand)]" />
          ) : (
            <Lock size={18} className="text-[var(--color-brand)]" />
          )}
          <span className="text-sm font-medium text-[var(--color-text-primary)] capitalize">
            {status?.method || '—'}
          </span>
          <Badge variant="success">Active</Badge>
        </div>
      </Card>

      {/* Passkey-specific options */}
      {status?.method === 'passkey' && (
        <>
          <ReconfigurePasskeyCard onDone={refresh} />
          <BackupPasswordCard hasBackup={status.hasPasswordBackup} onDone={refresh} />
        </>
      )}

      {status?.method === 'password' && (
        <Card>
          <CardHeader
            title="Passkey"
            description="Passkey support is only available when passkey is the primary method."
          />
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            To switch to passkey, reset your vault from the setup screen.
          </p>
        </Card>
      )}
    </div>
  )
}

// ─── Reconfigure Passkey ──────────────────────────────────────────────────────

const ReconfigurePasskeyCard: FC<{ onDone: () => void }> = ({ onDone }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handle = async () => {
    setLoading(true)
    setError('')
    setSuccess(false)
    try {
      const rawOptions = await vaultApi.beginReconfigurePasskey()
      const wrapper = rawOptions as unknown as Record<string, unknown>
      const serverOptions = (wrapper['publicKey'] ?? wrapper) as Record<string, unknown>
      const userField = serverOptions['user'] as Record<string, unknown>

      const publicKey: PublicKeyCredentialCreationOptions = {
        ...(serverOptions as unknown as PublicKeyCredentialCreationOptions),
        challenge: base64urlToBuffer(serverOptions['challenge'] as string),
        user: {
          id: base64urlToBuffer(userField['id'] as string),
          name: userField['name'] as string,
          displayName: userField['displayName'] as string,
        },
        excludeCredentials: [],
      }

      const credential = await navigator.credentials.create({ publicKey })
      if (!credential || credential.type !== 'public-key') {
        throw new Error('Passkey registration was cancelled.')
      }

      const pkCred = credential as PublicKeyCredential
      const response = pkCred.response as AuthenticatorAttestationResponse
      const transports: AuthenticatorTransport[] = response.getTransports
        ? (response.getTransports() as AuthenticatorTransport[])
        : []

      const payload: RegistrationResponseJSON = {
        id: pkCred.id,
        rawId: bufferToBase64url(pkCred.rawId),
        type: 'public-key',
        response: {
          clientDataJSON: bufferToBase64url(response.clientDataJSON),
          attestationObject: bufferToBase64url(response.attestationObject),
          transports,
        },
        clientExtensionResults: pkCred.getClientExtensionResults(),
      }

      await vaultApi.finishReconfigurePasskey(payload)
      setSuccess(true)
      onDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reconfigure passkey.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Reconfigure passkey"
        description="Register a new passkey to replace the current one. Your data stays intact."
      />
      <div className="mt-4 space-y-3">
        {error && (
          <p className="text-xs text-[var(--color-danger)] flex items-center gap-1.5">
            <AlertTriangle size={12} /> {error}
          </p>
        )}
        {success && (
          <p className="text-xs text-[var(--color-success)] flex items-center gap-1.5">
            <ShieldCheck size={12} /> Passkey updated successfully.
          </p>
        )}
        <Button
          variant="secondary"
          icon={<RefreshCw size={14} />}
          loading={loading}
          onClick={() => void handle()}
        >
          Register new passkey
        </Button>
      </div>
    </Card>
  )
}

// ─── Backup Password ──────────────────────────────────────────────────────────

const BackupPasswordCard: FC<{ hasBackup: boolean; onDone: () => void }> = ({
  hasBackup,
  onDone,
}) => {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const mismatch = confirm.length > 0 && password !== confirm
  const tooShort = password.length > 0 && password.length < 8

  const handleAdd = async () => {
    if (password !== confirm || password.length < 8) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await vaultApi.addPasswordBackup(password)
      setPassword('')
      setConfirm('')
      setSuccess('Backup password set.')
      onDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to set backup password.')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await vaultApi.removePasswordBackup()
      setSuccess('Backup password removed.')
      onDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove backup password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Backup password"
        description={
          hasBackup
            ? 'A backup password is set. You can use it if your passkey is unavailable.'
            : 'Add a password as a fallback in case your passkey is unavailable.'
        }
        actions={
          hasBackup ? (
            <Badge variant="success">Enabled</Badge>
          ) : (
            <Badge variant="default">Not set</Badge>
          )
        }
      />

      <div className="mt-4 space-y-3">
        {error && (
          <p className="text-xs text-[var(--color-danger)] flex items-center gap-1.5">
            <AlertTriangle size={12} /> {error}
          </p>
        )}
        {success && (
          <p className="text-xs text-[var(--color-success)] flex items-center gap-1.5">
            <ShieldCheck size={12} /> {success}
          </p>
        )}

        {!hasBackup ? (
          <>
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              error={tooShort ? 'Must be at least 8 characters' : undefined}
              prefix={<KeyRound size={13} />}
              suffix={
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="focus:outline-none">
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              }
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              error={mismatch ? 'Passwords do not match' : undefined}
              prefix={<KeyRound size={13} />}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd() }}
            />
            <Button
              variant="primary"
              icon={<Lock size={14} />}
              loading={loading}
              disabled={!password || !confirm || mismatch || tooShort}
              onClick={() => void handleAdd()}
            >
              Set backup password
            </Button>
          </>
        ) : (
          <Button
            variant="danger"
            icon={<Trash2 size={14} />}
            loading={loading}
            onClick={() => void handleRemove()}
          >
            Remove backup password
          </Button>
        )}
      </div>
    </Card>
  )
}

// ─── WebAuthn helpers ─────────────────────────────────────────────────────────

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const buffer = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
  return buffer
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (const byte of bytes) str += String.fromCharCode(byte)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

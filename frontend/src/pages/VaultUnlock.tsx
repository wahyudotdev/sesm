import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Lock, Fingerprint, ShieldCheck, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import type { FC } from 'react'

import { vaultApi } from '@/api/vault'
import type { AuthenticationResponseJSON } from '@/api/vault'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface VaultUnlockProps {
  method: 'password' | 'passkey' | ''
  hasPasswordBackup: boolean
  onUnlock: () => void
}

export const VaultUnlock: FC<VaultUnlockProps> = ({ method, hasPasswordBackup, onUnlock }) => {
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [useBackup, setUseBackup] = useState(false)

  const handlePasswordUnlock = async () => {
    if (!password) return
    setLoading(true)
    setError('')
    try {
      await vaultApi.unlockPassword(password)
      await queryClient.invalidateQueries({ queryKey: ['vault-status'] })
      onUnlock()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Incorrect password.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasskeyUnlock = async () => {
    setLoading(true)
    setError('')
    try {
      // Server returns options with base64url-encoded binary fields
      const rawOptions = await vaultApi.beginPasskeyUnlock()

      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn is not supported in this browser.')
      }

      // go-webauthn wraps options under a "publicKey" key
      const wrapper = rawOptions as unknown as Record<string, unknown>
      const serverOptions = (wrapper['publicKey'] ?? wrapper) as Record<string, unknown>
      const rawAllowCredentials = serverOptions['allowCredentials'] as
        | Array<Record<string, unknown>>
        | undefined

      const allowCredentials: PublicKeyCredentialDescriptor[] = (rawAllowCredentials ?? []).map(
        (c) => ({
          type: c['type'] as PublicKeyCredentialType,
          id: base64urlToBuffer(c['id'] as string),
          transports: (c['transports'] as AuthenticatorTransport[] | undefined) ?? [],
        }),
      )

      const publicKey: PublicKeyCredentialRequestOptions = {
        challenge: base64urlToBuffer(serverOptions['challenge'] as string),
        allowCredentials,
        timeout: (serverOptions['timeout'] as number | undefined) ?? 60000,
        rpId: serverOptions['rpId'] as string | undefined,
        userVerification:
          (serverOptions['userVerification'] as UserVerificationRequirement | undefined) ??
          'preferred',
      }

      const assertion = await navigator.credentials.get({ publicKey })
      if (!assertion || assertion.type !== 'public-key') {
        throw new Error('Passkey authentication was cancelled or failed.')
      }

      const pkAssertion = assertion as PublicKeyCredential
      const response = pkAssertion.response as AuthenticatorAssertionResponse

      const authResponse: AuthenticationResponseJSON = {
        id: pkAssertion.id,
        rawId: bufferToBase64url(pkAssertion.rawId),
        type: 'public-key',
        response: {
          clientDataJSON: bufferToBase64url(response.clientDataJSON),
          authenticatorData: bufferToBase64url(response.authenticatorData),
          signature: bufferToBase64url(response.signature),
          userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
        },
        clientExtensionResults: pkAssertion.getClientExtensionResults(),
      }

      await vaultApi.finishPasskeyUnlock(authResponse)
      await queryClient.invalidateQueries({ queryKey: ['vault-status'] })
      onUnlock()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Passkey authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)] p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--color-brand-muted)] mb-4">
            <ShieldCheck size={28} className="text-[var(--color-brand)]" />
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
            Unlock vault
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {method === 'password'
              ? 'Enter your password to decrypt your data.'
              : 'Authenticate with your passkey to continue.'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-6">
          {method === 'password' && (
            <div className="space-y-4">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your vault password"
                autoFocus
                suffix={
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="focus:outline-none">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handlePasswordUnlock()
                }}
              />

              {error && (
                <p className="text-xs text-[var(--color-danger)] flex items-center gap-1.5">
                  <AlertTriangle size={12} /> {error}
                </p>
              )}

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                loading={loading}
                disabled={!password}
                icon={<Lock size={16} />}
                onClick={() => void handlePasswordUnlock()}
              >
                Unlock
              </Button>
            </div>
          )}

          {method === 'passkey' && !useBackup && (
            <div className="space-y-4">
              {error && (
                <p className="text-xs text-[var(--color-danger)] flex items-center gap-1.5">
                  <AlertTriangle size={12} /> {error}
                </p>
              )}

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                loading={loading}
                icon={<Fingerprint size={16} />}
                onClick={() => void handlePasskeyUnlock()}
              >
                Unlock with passkey
              </Button>

              {hasPasswordBackup && (
                <button
                  type="button"
                  onClick={() => { setUseBackup(true); setError('') }}
                  className="w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors text-center"
                >
                  Use backup password instead
                </button>
              )}
            </div>
          )}

          {method === 'passkey' && useBackup && (
            <div className="space-y-4">
              <button
                onClick={() => { setUseBackup(false); setError('') }}
                className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                ← Back to passkey
              </button>

              <Input
                label="Backup password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your backup password"
                autoFocus
                suffix={
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="focus:outline-none">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
                onKeyDown={(e) => { if (e.key === 'Enter') void handlePasswordUnlock() }}
              />

              {error && (
                <p className="text-xs text-[var(--color-danger)] flex items-center gap-1.5">
                  <AlertTriangle size={12} /> {error}
                </p>
              )}

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                loading={loading}
                disabled={!password}
                icon={<Lock size={16} />}
                onClick={() => void handlePasswordUnlock()}
              >
                Unlock
              </Button>
            </div>
          )}

          {method === '' && (
            <p className="text-sm text-[var(--color-text-secondary)] text-center">
              Vault method unknown. Please restart the application.
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-[var(--color-text-muted)]">
          SESM — AWS Session Manager
        </p>
      </div>
    </div>
  )
}

// Helpers for WebAuthn buffer conversions
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const buffer = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i)
  }
  return buffer
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (const byte of bytes) {
    str += String.fromCharCode(byte)
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

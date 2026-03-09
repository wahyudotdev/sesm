import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Lock, Fingerprint, ShieldCheck, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import type { FC } from 'react'

import { vaultApi } from '@/api/vault'
import type { RegistrationResponseJSON } from '@/api/vault'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Step = 'choose' | 'password' | 'passkey'

interface VaultSetupProps {
  onComplete: () => void
}

export const VaultSetup: FC<VaultSetupProps> = ({ onComplete }) => {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('choose')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const passwordMismatch = confirm.length > 0 && password !== confirm
  const passwordTooShort = password.length > 0 && password.length < 8

  const handlePasswordSetup = async () => {
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await vaultApi.setupPassword(password)
      await queryClient.invalidateQueries({ queryKey: ['vault-status'] })
      onComplete()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Setup failed.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasskeySetup = async () => {
    setLoading(true)
    setError('')
    try {
      // Server returns options with base64url-encoded binary fields
      const rawOptions = await vaultApi.beginPasskeySetup()

      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn is not supported in this browser.')
      }

      // go-webauthn wraps options under a "publicKey" key
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
        throw new Error('Passkey creation was cancelled or failed.')
      }

      const pkCred = credential as PublicKeyCredential
      const response = pkCred.response as AuthenticatorAttestationResponse

      const transports: AuthenticatorTransport[] = response.getTransports
        ? (response.getTransports() as AuthenticatorTransport[])
        : []

      const registrationResponse: RegistrationResponseJSON = {
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

      await vaultApi.finishPasskeySetup(registrationResponse)
      await queryClient.invalidateQueries({ queryKey: ['vault-status'] })
      onComplete()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Passkey setup failed.')
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
            Secure your vault
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            SESM encrypts your AWS credentials and session data at rest.
            <br />
            Choose how you want to protect them.
          </p>
        </div>

        {/* Card */}
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-6">
          {step === 'choose' && (
            <div className="space-y-3">
              <button
                onClick={() => setStep('password')}
                className="w-full flex items-start gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-brand-muted)] transition-all text-left group"
              >
                <div className="mt-0.5 w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-[var(--color-bg-muted)] group-hover:bg-[var(--color-brand-muted)]">
                  <Lock size={18} className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-brand)]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">Password</div>
                  <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                    Argon2id key derivation + AES-256-GCM. Strong at-rest encryption.
                  </div>
                </div>
              </button>

              <button
                onClick={() => setStep('passkey')}
                className="w-full flex items-start gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-brand-muted)] transition-all text-left group"
              >
                <div className="mt-0.5 w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-[var(--color-bg-muted)] group-hover:bg-[var(--color-brand-muted)]">
                  <Fingerprint size={18} className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-brand)]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">Passkey</div>
                  <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                    WebAuthn / biometrics. Convenient, device-bound authentication.
                  </div>
                </div>
              </button>
            </div>
          )}

          {step === 'password' && (
            <div className="space-y-4">
              <button
                onClick={() => { setStep('choose'); setError(''); setPassword(''); setConfirm('') }}
                className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-2"
              >
                ← Back
              </button>

              <div>
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Set a password</h2>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Your master key will be derived from this password using Argon2id.
                </p>
              </div>

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                error={passwordTooShort ? 'Must be at least 8 characters' : undefined}
                suffix={
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="focus:outline-none">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />

              <Input
                label="Confirm password"
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                error={passwordMismatch ? 'Passwords do not match' : undefined}
                suffix={
                  <button type="button" onClick={() => setShowConfirm((v) => !v)} className="focus:outline-none">
                    {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handlePasswordSetup()
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
                className="w-full mt-2"
                loading={loading}
                disabled={!password || !confirm || passwordMismatch || passwordTooShort}
                onClick={() => void handlePasswordSetup()}
              >
                Set password
              </Button>
            </div>
          )}

          {step === 'passkey' && (
            <div className="space-y-4">
              <button
                onClick={() => { setStep('choose'); setError('') }}
                className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-2"
              >
                ← Back
              </button>

              <div>
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Set up a passkey</h2>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Your device will prompt you to register a biometric or hardware key.
                </p>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-warning-muted)] border border-[var(--color-warning)]/20">
                <AlertTriangle size={14} className="text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--color-warning)]">
                  Passkey mode protects app access, but data encryption uses a stored wrapping key. For the strongest at-rest encryption, use a password.
                </p>
              </div>

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
                onClick={() => void handlePasskeySetup()}
              >
                Register passkey
              </Button>
            </div>
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

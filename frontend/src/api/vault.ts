import { del, post } from './client'
import client from './client'
import type { ApiResponse } from '@/types'

export interface VaultStatus {
  initialized: boolean
  method: 'password' | 'passkey' | ''
  unlocked: boolean
  hasPasswordBackup: boolean
}

// WebAuthn JSON response types (L3 spec — not always in lib.dom)
export interface RegistrationResponseJSON {
  id: string
  rawId: string
  type: 'public-key'
  response: {
    clientDataJSON: string
    attestationObject: string
    transports?: AuthenticatorTransport[]
  }
  clientExtensionResults: AuthenticationExtensionsClientOutputs
}

export interface AuthenticationResponseJSON {
  id: string
  rawId: string
  type: 'public-key'
  response: {
    clientDataJSON: string
    authenticatorData: string
    signature: string
    userHandle: string | null
  }
  clientExtensionResults: AuthenticationExtensionsClientOutputs
}

export const vaultApi = {
  status: async (): Promise<VaultStatus> => {
    const res = await client.get<ApiResponse<VaultStatus>>('/vault/status')
    if (res.data.error) throw new Error(res.data.error)
    return res.data.data as VaultStatus
  },

  setupPassword: (password: string) =>
    post<void>('/vault/setup/password', { password }),

  beginPasskeySetup: () =>
    post<PublicKeyCredentialCreationOptions>('/vault/setup/passkey/begin', {}),

  finishPasskeySetup: (credential: RegistrationResponseJSON) =>
    post<void>('/vault/setup/passkey/finish', credential),

  unlockPassword: (password: string) =>
    post<void>('/vault/unlock/password', { password }),

  beginPasskeyUnlock: () =>
    post<PublicKeyCredentialRequestOptions>('/vault/unlock/passkey/begin', {}),

  finishPasskeyUnlock: (assertion: AuthenticationResponseJSON) =>
    post<void>('/vault/unlock/passkey/finish', assertion),

  addPasswordBackup: (password: string) =>
    post<void>('/vault/backup/password', { password }),

  removePasswordBackup: () => del<void>('/vault/backup/password'),

  beginReconfigurePasskey: () =>
    post<PublicKeyCredentialCreationOptions>('/vault/passkey/reconfigure/begin', {}),

  finishReconfigurePasskey: (credential: RegistrationResponseJSON) =>
    post<void>('/vault/passkey/reconfigure/finish', credential),
}

import { del, get, patch, post } from './client'

import type { PortForwardRule } from '@/types'

export const rulesApi = {
  list: () => get<PortForwardRule[]>('/rules'),
  create: (data: {
    name: string
    profileId: string
    instanceId: string
    instanceName: string
    localPort: number
    remotePort: number
    remoteHost?: string
  }) => post<PortForwardRule>('/rules', data),
  toggle: (id: string, enabled: boolean) => patch<void>(`/rules/${id}/toggle`, { enabled }),
  delete: (id: string) => del<void>(`/rules/${id}`),
}

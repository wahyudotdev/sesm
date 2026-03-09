import { get, post } from './client'

import type { Session, DashboardStats } from '@/types'

export const sessionsApi = {
  stats: () => get<DashboardStats>('/stats'),
  list: () => get<Session[]>('/sessions'),
  portForward: (data: {
    profileId: string
    instanceId: string
    instanceName: string
    localPort: number
    remotePort: number
    remoteHost?: string
  }) => post<{ id: string }>('/sessions/port-forward', data),
  terminate: (id: string) => post<void>(`/sessions/${id}/terminate`, {}),
}

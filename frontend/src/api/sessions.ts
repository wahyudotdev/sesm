import { get, post } from './client'

import type { Session, DashboardStats } from '@/types'

export const sessionsApi = {
  stats: () => get<DashboardStats>('/stats'),
  list: () => get<Session[]>('/sessions'),
  terminate: (id: string) => post<void>(`/sessions/${id}/terminate`, {}),
}

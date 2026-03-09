import { get, post } from './client'

import type { Instance } from '@/types'

export const instancesApi = {
  list: (profileId: string) => get<Instance[]>(`/instances?profileId=${encodeURIComponent(profileId)}`),
  setAlias: (instanceId: string, alias: string) =>
    post<void>(`/instances/${encodeURIComponent(instanceId)}/alias`, { alias }),
}

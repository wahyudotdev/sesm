import { get } from './client'

import type { Instance } from '@/types'

export const instancesApi = {
  list: (profileId: string) => get<Instance[]>(`/instances?profileId=${encodeURIComponent(profileId)}`),
}

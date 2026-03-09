import { get, post, del } from './client'

import type { CreateProfileRequest, Profile } from '@/types'

export const profilesApi = {
  list: () => get<Profile[]>('/profiles'),
  get: (id: string) => get<Profile>(`/profiles/${id}`),
  create: (data: CreateProfileRequest) => post<Profile>('/profiles', data),
  delete: (id: string) => del<void>(`/profiles/${id}`),
}

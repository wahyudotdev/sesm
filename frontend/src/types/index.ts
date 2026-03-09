export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface Profile {
  id: string
  name: string
  region: string
  accessKeyId: string
  accountId?: string
  createdAt: string
  updatedAt: string
}

export interface CreateProfileRequest {
  name: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  accountId?: string
}

export interface Instance {
  instanceId: string
  name: string
  type: string
  state: 'running' | 'offline'
  platform: string
  privateIp: string
  resourceType: string
}

export interface Session {
  id: string
  profileId: string
  profileName: string
  instanceId: string
  instanceName: string
  type: 'terminal' | 'port-forward'
  status: 'active' | 'terminated' | 'failed'
  localPort?: number
  remotePort?: number
  remoteHost?: string
  startedAt: string
  endedAt?: string
}

export interface PortForwardRule {
  id: string
  name: string
  profileId: string
  instanceId: string
  localPort: number
  remotePort: number
  remoteHost: string
  createdAt: string
}

export interface DashboardStats {
  totalProfiles: number
  activeSessions: number
  totalSessions: number
  recentSessions: Session[]
}

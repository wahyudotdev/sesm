import { Outlet, useLocation } from 'react-router-dom'

import type { FC } from 'react'

import { Header } from './Header'
import { Sidebar } from './Sidebar'

const routeMeta: Record<string, { title: string; description?: string }> = {
  '/': { title: 'Dashboard', description: 'Overview of your AWS SSM sessions and profiles' },
  '/profiles': { title: 'Profiles', description: 'Manage your AWS credential profiles' },
  '/instances': { title: 'Instances', description: 'Browse and connect to EC2 instances' },
  '/terminal': { title: 'Terminal', description: 'Open SSM terminal sessions' },
  '/port-forward': { title: 'Port Forward', description: 'Configure and manage port-forwarding rules' },
  '/history': { title: 'History', description: 'View past sessions and connections' },
  '/settings': { title: 'Settings', description: 'Configure application preferences' },
}

export const AppLayout: FC = () => {
  const location = useLocation()
  const meta = routeMeta[location.pathname] ?? { title: 'SESM' }

  return (
    <div className="flex h-full bg-[var(--color-bg-base)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={meta.title} description={meta.description} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

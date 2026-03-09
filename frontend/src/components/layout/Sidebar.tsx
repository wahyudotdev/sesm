import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  KeyRound,
  Server,
  ArrowRightLeft,
  History,
  Settings,
  Terminal,
  ChevronRight,
} from 'lucide-react'

import type { FC } from 'react'

interface NavItem {
  label: string
  to: string
  icon: FC<{ size?: number; className?: string }>
  badge?: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Profiles', to: '/profiles', icon: KeyRound },
  { label: 'Instances', to: '/instances', icon: Server },
  { label: 'Terminal', to: '/terminal', icon: Terminal },
  { label: 'Port Forward', to: '/port-forward', icon: ArrowRightLeft },
  { label: 'History', to: '/history', icon: History },
]

const bottomNavItems: NavItem[] = [{ label: 'Settings', to: '/settings', icon: Settings }]

export const Sidebar: FC = () => (
  <aside className="w-56 shrink-0 h-full flex flex-col bg-[var(--color-bg-surface)] border-r border-[var(--color-border)]">
    {/* Logo */}
    <div className="h-14 flex items-center px-4 border-b border-[var(--color-border)]">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[var(--color-brand)] flex items-center justify-center shadow-md shadow-[var(--color-brand)]/30">
          <Terminal size={14} className="text-white" />
        </div>
        <span className="font-semibold text-sm text-[var(--color-text-primary)] tracking-tight">
          SESM
        </span>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[var(--color-brand-muted)] text-[var(--color-brand)] leading-none">
          beta
        </span>
      </div>
    </div>

    {/* Main nav */}
    <nav className="flex-1 overflow-y-auto py-3 px-2">
      <div className="mb-1 px-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          Main
        </span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150
                ${
                  isActive
                    ? 'bg-[var(--color-brand-muted)] text-[var(--color-brand)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={14}
                    className={`shrink-0 ${isActive ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]'}`}
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-brand)] text-white">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <ChevronRight size={12} className="text-[var(--color-brand)] opacity-60" />
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>

    {/* Bottom nav */}
    <div className="py-3 px-2 border-t border-[var(--color-border)]">
      <ul className="flex flex-col gap-0.5">
        {bottomNavItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150
                ${
                  isActive
                    ? 'bg-[var(--color-brand-muted)] text-[var(--color-brand)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={14}
                    className={`shrink-0 ${isActive ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]'}`}
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Version */}
      <div className="mt-3 px-2.5">
        <p className="text-[10px] text-[var(--color-text-muted)]">v0.1.0</p>
      </div>
    </div>
  </aside>
)

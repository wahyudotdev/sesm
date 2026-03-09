import { useCallback } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/pages/Dashboard'
import { Instances } from '@/pages/Instances'
import { Placeholder } from '@/pages/Placeholder'
import { PortForward } from '@/pages/PortForward'
import { Profiles } from '@/pages/Profiles'
import { Terminal } from '@/pages/Terminal'
import { Security } from '@/pages/Security'
import { VaultSetup } from '@/pages/VaultSetup'
import { VaultUnlock } from '@/pages/VaultUnlock'
import { Spinner } from '@/components/ui/Spinner'
import { vaultApi } from '@/api/vault'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

const AppInner = () => {
  const qc = useQueryClient()

  const { data: vaultStatus, isLoading } = useQuery({
    queryKey: ['vault-status'],
    queryFn: vaultApi.status,
    staleTime: 0,
  })

  const handleVaultReady = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['vault-status'] })
  }, [qc])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)]">
        <Spinner />
      </div>
    )
  }

  if (!vaultStatus?.initialized) {
    return <VaultSetup onComplete={handleVaultReady} />
  }

  if (!vaultStatus?.unlocked) {
    return <VaultUnlock method={vaultStatus.method} hasPasswordBackup={vaultStatus.hasPasswordBackup} onUnlock={handleVaultReady} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/profiles" element={<Profiles />} />
          <Route path="/instances" element={<Instances />} />
          <Route path="/terminal" element={<Terminal />} />
          <Route path="/port-forward" element={<PortForward />} />
          <Route path="/security" element={<Security />} />
          <Route
            path="/history"
            element={
              <Placeholder
                title="Session History"
                description="Browse past terminal and port-forward sessions. Coming soon."
              />
            }
          />
          <Route
            path="/settings"
            element={
              <Placeholder
                title="Settings"
                description="Configure application preferences and defaults. Coming soon."
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppInner />
  </QueryClientProvider>
)

export default App

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/pages/Dashboard'
import { Instances } from '@/pages/Instances'
import { Placeholder } from '@/pages/Placeholder'
import { PortForward } from '@/pages/PortForward'
import { Profiles } from '@/pages/Profiles'
import { Terminal } from '@/pages/Terminal'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/profiles" element={<Profiles />} />
          <Route path="/instances" element={<Instances />} />
          <Route path="/terminal" element={<Terminal />} />
          <Route path="/port-forward" element={<PortForward />} />
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
  </QueryClientProvider>
)

export default App

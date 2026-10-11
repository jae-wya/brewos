import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getSession } from '../../lib/session'

// No stored session -> login, returning here afterwards. An expired token is
// caught by the 401 handler in lib/api.ts, not here.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  if (!getSession()) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <>{children}</>
}

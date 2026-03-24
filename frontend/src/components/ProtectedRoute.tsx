import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { FullPageSpinner } from './ui/Spinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, initialized, session } = useAuthStore()

  if (!initialized) return <FullPageSpinner />
  if (!user || !session) return <Navigate to="/login" replace />

  if (requireAdmin) {
    const rol = session.user?.user_metadata?.rol ?? session.user?.app_metadata?.rol
    if (rol !== 'admin') return <Navigate to="/" replace />
  }

  return <>{children}</>
}

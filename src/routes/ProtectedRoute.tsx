import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'
import { FullScreenLoader } from '../components/ui/Spinner'

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (!isSupabaseConfigured) return <Navigate to="/status" replace />
  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}
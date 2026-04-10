import type { ReactElement } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/components/use-auth'

export function ProtectedRoute({ children }: { children: ReactElement }) {
	const { ready, token } = useAuth()
	const location = useLocation()

	if (!ready) {
		return <div className="flex min-h-screen items-center justify-center text-muted">Loading session...</div>
	}
	if (!token) {
		return <Navigate to="/login" replace state={{ from: location.pathname }} />
	}
	return children
}
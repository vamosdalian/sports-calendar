import { Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from '@/components/auth-provider'
import { ProtectedRoute } from '@/components/protected-route'
import { AdminShell } from '@/components/layout/admin-shell'
import { ToastProvider } from '@/components/ui/toast'
import { DashboardPage } from '@/pages/dashboard-page'
import { LeaguesPage } from '@/pages/leagues-page'
import { LoginPage } from '@/pages/login-page'
import { SeasonsPage } from '@/pages/seasons-page'
import { SportsPage } from '@/pages/sports-page'

export default function App() {
	return (
		<AuthProvider>
			<ToastProvider>
				<Routes>
					<Route path="/login" element={<LoginPage />} />
					<Route
						path="/"
						element={
							<ProtectedRoute>
								<AdminShell />
							</ProtectedRoute>
						}
					>
						<Route index element={<DashboardPage />} />
						<Route path="sports" element={<SportsPage />} />
						<Route path="sports/:sportSlug/leagues" element={<LeaguesPage />} />
						<Route path="sports/:sportSlug/leagues/:leagueSlug/seasons" element={<SeasonsPage />} />
					</Route>
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</ToastProvider>
		</AuthProvider>
	)
}

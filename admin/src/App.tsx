import { Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from '@/components/auth-provider'
import { ProtectedRoute } from '@/components/protected-route'
import { AdminShell } from '@/components/layout/admin-shell'
import { Toaster } from '@/components/ui/sonner'
import { DashboardPage } from '@/pages/dashboard-page'
import { LeaguesPage } from '@/pages/leagues-page'
import { LoginPage } from '@/pages/login-page'
import { MatchesPage } from '@/pages/matches-page'
import { SeasonsPage } from '@/pages/seasons-page'
import { SportsPage } from '@/pages/sports-page'
import { TeamsPage } from '@/pages/teams-page'

export default function App() {
	return (
		<AuthProvider>
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
					<Route path="sports/:sportSlug/leagues/:leagueSlug/teams" element={<TeamsPage />} />
					<Route path="sports/:sportSlug/leagues/:leagueSlug/seasons" element={<SeasonsPage />} />
					<Route path="sports/:sportSlug/leagues/:leagueSlug/seasons/:seasonSlug/matches" element={<MatchesPage />} />
				</Route>
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
			<Toaster position="top-right" richColors closeButton />
		</AuthProvider>
	)
}

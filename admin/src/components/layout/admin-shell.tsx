import { ChartNoAxesCombined, Flag, LogOut, ShieldCheck } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
	{ to: '/', label: 'Overview', icon: ChartNoAxesCombined },
	{ to: '/sports', label: 'Sports', icon: Flag },
]

export function AdminShell() {
	const { email, logout } = useAuth()

	return (
		<div className="min-h-screen px-4 py-6 md:px-6">
			<div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
				<aside className="panel-surface flex flex-col overflow-hidden bg-header text-white">
					<div className="border-b border-white/10 px-6 py-6">
						<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
							<ShieldCheck className="h-6 w-6" />
						</div>
						<h1 className="font-display text-2xl font-bold">Admin Control</h1>
						<p className="mt-2 text-sm text-white/72">Sports catalog, season setup, and fixture oversight.</p>
					</div>
					<nav className="space-y-2 px-4 py-4">
						{navItems.map((item) => (
							<NavLink
								key={item.to}
								to={item.to}
								end={item.to === '/'}
								className={({ isActive }) =>
									cn(
										'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
										isActive ? 'bg-white text-header shadow-lg' : 'text-white/80 hover:bg-white/10 hover:text-white',
									)
								}
							>
								<item.icon className="h-4 w-4" />
								<span>{item.label}</span>
							</NavLink>
						))}
					</nav>
					<div className="mt-auto border-t border-white/10 px-6 py-6">
						<p className="text-xs uppercase tracking-[0.18em] text-white/55">Signed in</p>
						<p className="mt-2 break-all text-sm font-medium">{email}</p>
						<Button className="mt-4 w-full bg-white text-header hover:bg-white/90" onClick={logout}>
							<LogOut className="mr-2 h-4 w-4" />
							Sign out
						</Button>
					</div>
				</aside>
				<main className="space-y-6">
					<Outlet />
				</main>
			</div>
		</div>
	)
}
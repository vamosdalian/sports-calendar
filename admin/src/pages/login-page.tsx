import { useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@/components/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
	const { token, login, register } = useAuth()
	const navigate = useNavigate()
	const location = useLocation()
	const [email, setEmail] = useState('admin@example.com')
	const [password, setPassword] = useState('secret123')
	const [mode, setMode] = useState<'login' | 'register'>('login')
	const [pending, setPending] = useState(false)
	const [message, setMessage] = useState<string | null>(null)

	const redirectPath = useMemo(() => ((location.state as { from?: string } | null)?.from) || '/', [location.state])

	if (token) {
		return <Navigate to={redirectPath} replace />
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setPending(true)
		setMessage(null)
		try {
			if (mode === 'register') {
				await register(email, password)
				setMode('login')
				setMessage('Bootstrap admin created. Please log in.')
			} else {
				await login(email, password)
				navigate(redirectPath, { replace: true })
			}
		} catch (caught) {
			setMessage(caught instanceof Error ? caught.message : 'request failed')
		} finally {
			setPending(false)
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center px-4 py-10">
			<div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
				<section className="panel-surface overflow-hidden bg-header px-8 py-10 text-white">
					<p className="text-sm uppercase tracking-[0.24em] text-white/60">Sports Calendar</p>
					<h1 className="mt-5 font-display text-5xl font-bold leading-tight">Operations console for leagues, seasons, and fixture oversight.</h1>
					<p className="mt-6 max-w-xl text-base text-white/75">Use this admin console to bootstrap sports catalogs, connect TheSportsDB-backed leagues, and inspect season fixtures before publishing.</p>
				</section>
				<Card>
					<CardHeader>
						<CardTitle>{mode === 'login' ? 'Admin login' : 'Bootstrap first admin'}</CardTitle>
						<CardDescription>{mode === 'login' ? 'Enter the admin email and password to access protected catalog APIs.' : 'This registration path only works before the first admin exists.'}</CardDescription>
					</CardHeader>
					<CardContent>
						<form className="space-y-4" onSubmit={handleSubmit}>
							<div>
								<Label htmlFor="email">Email</Label>
								<Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
							</div>
							<div>
								<Label htmlFor="password">Password</Label>
								<Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
							</div>
							{message ? <p className="rounded-lg bg-shell px-4 py-3 text-sm text-ink">{message}</p> : null}
							<Button className="w-full" disabled={pending} type="submit">{pending ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create bootstrap admin'}</Button>
							<Button className="w-full" onClick={() => setMode((current) => (current === 'login' ? 'register' : 'login'))} type="button" variant="outline">
								{mode === 'login' ? 'Need the first admin?' : 'Already have an admin?'}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
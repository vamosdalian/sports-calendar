import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { useAuth } from '@/components/use-auth'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const authSchema = z.object({
	email: z.string().email('Enter a valid admin email.'),
	password: z.string().min(8, 'Password must be at least 8 characters.'),
})

type AuthFormValues = z.infer<typeof authSchema>

export function LoginPage() {
	const { token, login, register } = useAuth()
	const navigate = useNavigate()
	const location = useLocation()
	const [mode, setMode] = useState<'login' | 'register'>('login')
	const [pending, setPending] = useState(false)
	const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
	const form = useForm<AuthFormValues>({
		resolver: zodResolver(authSchema),
		defaultValues: {
			email: 'admin@example.com',
			password: 'secret123',
		},
	})

	const redirectPath = useMemo(() => ((location.state as { from?: string } | null)?.from) || '/', [location.state])

	if (token) {
		return <Navigate to={redirectPath} replace />
	}

	async function handleSubmit(values: AuthFormValues) {
		setPending(true)
		setMessage(null)
		try {
			if (mode === 'register') {
				await register(values.email, values.password)
				setMode('login')
				setMessage({ tone: 'success', text: 'Bootstrap admin created. Please sign in.' })
			} else {
				await login(values.email, values.password)
				navigate(redirectPath, { replace: true })
			}
		} catch (caught) {
			setMessage({ tone: 'error', text: caught instanceof Error ? caught.message : 'Request failed.' })
		} finally {
			setPending(false)
		}
	}

	return (
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--highlight)/0.22),transparent_30%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/0.18),transparent_24%)]" />
			<div className="relative grid w-full max-w-6xl gap-8 lg:grid-cols-[1.08fr_0.92fr]">
				<section className="panel-surface overflow-hidden border-0 bg-header px-8 py-10 text-white shadow-[0_32px_100px_rgba(76,29,149,0.28)]">
					<div className="inline-flex size-14 items-center justify-center rounded-3xl border border-white/15 bg-white/10 backdrop-blur">
						<ShieldCheck className="size-7" />
					</div>
					<p className="mt-6 text-sm uppercase tracking-[0.24em] text-white/60">Sports Calendar</p>
					<h1 className="mt-5 font-display text-5xl font-bold leading-tight">Operations console for leagues, seasons, and fixture oversight.</h1>
					<p className="mt-6 max-w-xl text-base text-white/78">Use this admin console to bootstrap sports catalogs, connect TheSportsDB-backed leagues, and inspect season fixtures before publishing.</p>
					<div className="mt-10 grid gap-4 md:grid-cols-2">
						<div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
							<p className="text-xs uppercase tracking-[0.18em] text-white/58">Catalog flow</p>
							<p className="mt-3 text-lg font-semibold">Sports, leagues, seasons</p>
						</div>
						<div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
							<p className="text-xs uppercase tracking-[0.18em] text-white/58">Backend mode</p>
							<p className="mt-3 text-lg font-semibold">Direct admin API access</p>
						</div>
					</div>
				</section>
				<Card className="border-white/60 bg-card/92 shadow-[0_32px_100px_rgba(15,23,42,0.12)] backdrop-blur">
					<CardHeader>
						<CardTitle>{mode === 'login' ? 'Admin login' : 'Bootstrap first admin'}</CardTitle>
						<CardDescription>{mode === 'login' ? 'Enter the admin email and password to access protected catalog APIs.' : 'This registration path only works before the first admin exists.'}</CardDescription>
					</CardHeader>
					<CardContent>
						<Form {...form}>
							<form className="flex flex-col gap-5" onSubmit={form.handleSubmit(handleSubmit)}>
								<FormField
									control={form.control}
									name="email"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Email</FormLabel>
											<FormControl>
												<Input autoComplete="email" placeholder="admin@example.com" type="email" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="password"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Password</FormLabel>
											<FormControl>
												<Input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Enter your password" type="password" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								{message ? (
									<Alert variant={message.tone === 'error' ? 'destructive' : 'default'}>
										<AlertCircle className="size-4" />
										<AlertTitle>{message.tone === 'error' ? 'Authentication error' : 'Ready'}</AlertTitle>
										<AlertDescription>{message.text}</AlertDescription>
									</Alert>
								) : null}
								<Button className="w-full" disabled={pending} type="submit">
									{pending ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create bootstrap admin'}
									<ArrowRight data-icon="inline-end" />
								</Button>
								<Button
									className="w-full"
									onClick={() => {
										setMode((current) => (current === 'login' ? 'register' : 'login'))
										setMessage(null)
									}}
									type="button"
									variant="outline"
								>
									{mode === 'login' ? 'Need the first admin?' : 'Already have an admin?'}
								</Button>
							</form>
						</Form>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
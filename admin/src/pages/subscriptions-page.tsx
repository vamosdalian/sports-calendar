import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useAuth } from '@/components/use-auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import type { ICSAnalyticsOverview } from '@/types'

// Human-readable names for the calendar clients the backend classifies.
const CLIENT_LABELS: Record<string, string> = {
	ios: 'iOS Calendar',
	macos: 'macOS Calendar',
	google: 'Google Calendar',
	outlook: 'Outlook',
	thunderbird: 'Thunderbird',
	davx5: 'ICSx5 / DAVx5 (Android)',
	other_calendar: 'Other calendar apps',
	browser: 'Browser (opened directly)',
	bot: 'Crawlers',
	unknown: 'Unknown',
}

// Clients excluded from subscriber counts by the backend. Shown greyed out so
// the numbers in the table are not mistaken for subscriptions.
const NON_SUBSCRIBER_CLIENTS = new Set(['browser', 'bot', 'unknown'])

function clientLabel(client: string) {
	return CLIENT_LABELS[client] ?? client
}

function feedLabel(feed: { leagueSlug: string; seasonSlug: string; teamSlug: string }) {
	const base = `${feed.leagueSlug} / ${feed.seasonSlug}`
	return feed.teamSlug ? `${base} / ${feed.teamSlug}` : base
}

export function SubscriptionsPage() {
	const { token } = useAuth()
	const [overview, setOverview] = useState<ICSAnalyticsOverview | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		if (!token) {
			return
		}
		setIsLoading(true)
		setError(null)
		try {
			setOverview(await api.getICSAnalytics(token, 30))
		} catch (err) {
			setError(err instanceof Error ? err.message : 'failed to load subscription analytics')
		} finally {
			setIsLoading(false)
		}
	}, [token])

	useEffect(() => {
		void load()
	}, [load])

	const totals = overview?.totals
	const metrics = [
		{
			title: 'Active subscribers (24h)',
			value: totals?.subscribersToday,
			hint: 'Distinct calendar clients that pulled a feed',
		},
		{
			title: 'Active subscribers (7d)',
			value: totals?.subscribers7d,
			hint: 'Clients seen in the last 7 days',
		},
		{
			title: 'Active subscribers (30d)',
			value: totals?.subscribers30d,
			hint: 'Clients seen in the last 30 days',
		},
		{
			title: 'Feed fetches (24h)',
			value: totals?.fetchesToday,
			hint: 'Raw requests, including crawlers',
		},
	]

	return (
		<div className="flex flex-col gap-4 lg:gap-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
					<p className="text-sm text-muted-foreground">
						Calendar clients re-poll their subscribed feeds automatically, so these numbers track live
						subscriptions rather than site traffic. Crawlers and one-off browser hits are excluded from
						subscriber counts.
					</p>
				</div>
				<Button disabled={isLoading} onClick={() => void load()} size="sm" variant="outline">
					{isLoading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
					Refresh
				</Button>
			</div>

			{error ? (
				<Card className="border-destructive/40">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-destructive">
							<AlertTriangle className="size-4" />
							Could not load analytics
						</CardTitle>
						<CardDescription>{error}</CardDescription>
					</CardHeader>
				</Card>
			) : null}

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{metrics.map((metric) => (
					<Card key={metric.title}>
						<CardHeader className="pb-2">
							<CardDescription>{metric.title}</CardDescription>
							<CardTitle className="text-3xl tabular-nums">
								{metric.value === undefined ? '—' : metric.value.toLocaleString()}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-xs text-muted-foreground">{metric.hint}</p>
						</CardContent>
					</Card>
				))}
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Daily trend</CardTitle>
					<CardDescription>
						Subscribers per day, summed across feeds. A client subscribed to two feeds counts in both, so
						this tracks direction — the headline figures above are the exact distinct counts.
					</CardDescription>
				</CardHeader>
				<CardContent className="h-[280px]">
					{overview && overview.trend.length > 0 ? (
						<ResponsiveContainer height="100%" width="100%">
							<AreaChart data={overview.trend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
								<CartesianGrid strokeDasharray="3 3" vertical={false} />
								<XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
								<YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={40} />
								<Tooltip />
								<Area
									dataKey="subscribers"
									fill="var(--color-primary)"
									fillOpacity={0.15}
									name="Subscribers"
									stroke="var(--color-primary)"
									strokeWidth={2}
									type="monotone"
								/>
							</AreaChart>
						</ResponsiveContainer>
					) : (
						<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
							{isLoading ? 'Loading…' : 'No data yet. The rollup runs every 10 minutes.'}
						</div>
					)}
				</CardContent>
			</Card>

			<div className="grid gap-4 xl:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Top feeds (7d)</CardTitle>
						<CardDescription>Which competitions people actually keep subscribed.</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Feed</TableHead>
									<TableHead className="text-right">Subscribers</TableHead>
									<TableHead className="text-right">Fetches</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{overview?.feeds.length ? (
									overview.feeds.slice(0, 15).map((feed) => (
										<TableRow key={`${feed.sportSlug}/${feed.leagueSlug}/${feed.seasonSlug}/${feed.teamSlug}`}>
											<TableCell className="font-medium">{feedLabel(feed)}</TableCell>
											<TableCell className="text-right tabular-nums">
												{feed.subscribers.toLocaleString()}
											</TableCell>
											<TableCell className="text-right tabular-nums text-muted-foreground">
												{feed.fetches.toLocaleString()}
											</TableCell>
										</TableRow>
									))
								) : (
									<TableRow>
										<TableCell className="text-sm text-muted-foreground" colSpan={3}>
											{isLoading ? 'Loading…' : 'No feed activity recorded yet.'}
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Calendar clients (7d)</CardTitle>
						<CardDescription>
							Decides which subscribe tutorial is worth writing next — today only the iOS guide exists.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Client</TableHead>
									<TableHead className="text-right">Subscribers</TableHead>
									<TableHead className="text-right">Fetches</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{overview?.clients.length ? (
									overview.clients.map((row) => {
										const excluded = NON_SUBSCRIBER_CLIENTS.has(row.client)
										return (
											<TableRow key={row.client}>
												<TableCell className="font-medium">
													<span className={excluded ? 'text-muted-foreground' : undefined}>
														{clientLabel(row.client)}
													</span>
													{excluded ? (
														<Badge className="ml-2" variant="outline">
															not counted
														</Badge>
													) : null}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{excluded ? '—' : row.subscribers.toLocaleString()}
												</TableCell>
												<TableCell className="text-right tabular-nums text-muted-foreground">
													{row.fetches.toLocaleString()}
												</TableCell>
											</TableRow>
										)
									})
								) : (
									<TableRow>
										<TableCell className="text-sm text-muted-foreground" colSpan={3}>
											{isLoading ? 'Loading…' : 'No client data recorded yet.'}
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>

			{overview ? (
				<p className="text-xs text-muted-foreground">
					Generated at {new Date(overview.generatedAt).toLocaleString()}. Detail rows are kept for 90 days;
					daily rollups are kept indefinitely.
				</p>
			) : null}
		</div>
	)
}

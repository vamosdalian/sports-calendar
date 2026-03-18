import {
	Activity,
	ArrowRight,
	CalendarRange,
	CheckCircle2,
	Database,
	Flag,
	RefreshCw,
	ShieldCheck,
	TableProperties,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const metrics = [
	{
		title: 'Sports',
		value: '14',
		delta: '+2 this week',
		icon: Flag,
	},
	{
		title: 'Leagues synced',
		value: '28',
		delta: '4 awaiting review',
		icon: RefreshCw,
	},
	{
		title: 'Active seasons',
		value: '41',
		delta: '6 imported today',
		icon: CalendarRange,
	},
	{
		title: 'Healthy services',
		value: '3/3',
		delta: 'API, auth, fixtures',
		icon: ShieldCheck,
	},
]

const workQueue = [
	{
		name: 'Basketball / NBA / 2025-2026',
		type: 'Season import',
		status: 'In review',
		owner: 'Admin',
		action: '/sports/basketball/leagues/nba/seasons',
	},
	{
		name: 'Football / CSL',
		type: 'League metadata',
		status: 'Ready',
		owner: 'Catalog',
		action: '/sports/football/leagues',
	},
	{
		name: 'Zhejiang / 2026',
		type: 'Fixture inspection',
		status: 'Blocked',
		owner: 'Fixtures',
		action: '/sports/football/leagues/zhejiang-julebu/seasons',
	},
	{
		name: 'Basketball root catalog',
		type: 'Sport setup',
		status: 'Ready',
		owner: 'Catalog',
		action: '/sports',
	},
]

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
	if (status === 'Ready') {
		return 'secondary'
	}

	if (status === 'Blocked') {
		return 'destructive'
	}

	if (status === 'In review') {
		return 'outline'
	}

	return 'default'
}

export function DashboardPage() {
	return (
		<div className="space-y-6">
			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{metrics.map((item) => (
					<Card key={item.title}>
						<CardHeader className="relative pb-3">
							<CardDescription>{item.title}</CardDescription>
							<CardTitle className="text-3xl font-semibold tabular-nums">{item.value}</CardTitle>
							<div className="absolute right-6 top-6 rounded-md border p-2 text-muted-foreground">
								<item.icon className="size-4" />
							</div>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">{item.delta}</p>
						</CardContent>
					</Card>
				))}
			</section>

			<section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_360px]">
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between gap-3">
							<div>
								<CardTitle>Catalog work queue</CardTitle>
								<CardDescription>Use the dashboard as the entry point into sport, league, and season operations.</CardDescription>
							</div>
							<Button asChild size="sm" variant="outline">
								<Link to="/sports">
									<TableProperties />
									<span>Open catalog</span>
								</Link>
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="overflow-hidden rounded-lg border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Item</TableHead>
										<TableHead>Type</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Owner</TableHead>
										<TableHead className="text-right">Action</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{workQueue.map((item) => (
										<TableRow key={item.name}>
											<TableCell>
												<div>
													<p className="font-medium text-foreground">{item.name}</p>
												</div>
											</TableCell>
											<TableCell className="text-muted-foreground">{item.type}</TableCell>
											<TableCell>
												<Badge variant={statusVariant(item.status)}>{item.status}</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground">{item.owner}</TableCell>
											<TableCell className="text-right">
												<Button asChild size="sm" variant="ghost">
													<Link to={item.action}>
														<span>Open</span>
														<ArrowRight />
													</Link>
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
						<div className="grid gap-4 md:grid-cols-3">
							<div className="rounded-lg border p-4">
								<p className="text-sm font-medium">Catalog flow</p>
								<p className="mt-2 text-sm text-muted-foreground">Start with sports, attach leagues, then import and inspect seasons.</p>
							</div>
							<div className="rounded-lg border p-4">
								<p className="text-sm font-medium">Pending review</p>
								<p className="mt-2 text-sm text-muted-foreground">4 upstream mappings still need manual verification before publish.</p>
							</div>
							<div className="rounded-lg border p-4">
								<p className="text-sm font-medium">Fixture confidence</p>
								<p className="mt-2 text-sm text-muted-foreground">Latest imports passed basic structure checks and are ready for spot inspection.</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<div className="grid gap-4">
					<Card>
						<CardHeader>
							<CardTitle>System status</CardTitle>
							<CardDescription>Operational checks for the admin stack.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex items-center justify-between rounded-lg border p-3">
								<div className="flex items-center gap-3">
									<CheckCircle2 className="size-4 text-primary" />
									<div>
										<p className="text-sm font-medium">Backend API</p>
										<p className="text-xs text-muted-foreground">Catalog mutations available</p>
									</div>
								</div>
								<Badge variant="secondary">Healthy</Badge>
							</div>
							<div className="flex items-center justify-between rounded-lg border p-3">
								<div className="flex items-center gap-3">
									<Activity className="size-4 text-primary" />
									<div>
										<p className="text-sm font-medium">Fixture ingestion</p>
										<p className="text-xs text-muted-foreground">Last sync completed today</p>
									</div>
								</div>
								<Badge variant="outline">Observed</Badge>
							</div>
							<div className="flex items-center justify-between rounded-lg border p-3">
								<div className="flex items-center gap-3">
									<Database className="size-4 text-primary" />
									<div>
										<p className="text-sm font-medium">PostgreSQL</p>
										<p className="text-xs text-muted-foreground">Primary storage online</p>
									</div>
								</div>
								<Badge variant="secondary">Healthy</Badge>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Recommended next steps</CardTitle>
							<CardDescription>Shortcut actions aligned with the admin flow.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<Button asChild className="w-full justify-between" variant="outline">
								<Link to="/sports">
									<span>Create or edit sports</span>
									<ArrowRight />
								</Link>
							</Button>
							<Button asChild className="w-full justify-between" variant="outline">
								<Link to="/sports/football/leagues">
									<span>Review football leagues</span>
									<ArrowRight />
								</Link>
							</Button>
							<Button asChild className="w-full justify-between" variant="outline">
								<Link to="/sports/basketball/leagues/nba/seasons">
									<span>Inspect NBA seasons</span>
									<ArrowRight />
								</Link>
							</Button>
						</CardContent>
					</Card>

					<Card>
					<CardHeader>
						<CardTitle>Publishing rule</CardTitle>
						<CardDescription>Keep the operator path explicit before public exposure.</CardDescription>
					</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">Every season should pass three gates before it is treated as publishable: upstream mapping, local metadata check, and fixture inspection through the public season endpoint.</p>
						</CardContent>
					</Card>
				</div>
			</section>
		</div>
	)
}
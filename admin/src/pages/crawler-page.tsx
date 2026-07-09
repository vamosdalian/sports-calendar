import {
	AlertTriangle,
	CalendarDays,
	ChevronDown,
	ChevronRight,
	Eye,
	Flag,
	Loader2,
	Search,
	Shield,
	Trophy,
	Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { CrawlerDataDialog, type DataTarget } from '@/components/crawler-data-dialog'
import { useAuth } from '@/components/use-auth'
import { useToast } from '@/components/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
	type Country,
	type CrawlKind,
	type CrawlStatus,
	type CrawlTask,
	type SpiderApi,
	createSpiderApi,
} from '@/lib/spider-api'

const TYPE_LABEL: Record<string, string> = {
	league: '联赛',
	cup: '杯赛',
	international: '洲际',
	other: '其他',
}

const KIND_LABEL: Record<CrawlKind, string> = {
	competition_clubs: '参赛队',
	competition_standings: '积分榜',
	competition_fixtures: '赛程',
	team_fixtures: '赛程',
	team_squad: '阵容',
	player_profile: '球员详情',
	fallback_discovery: '兜底发现',
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline'

function statusVariant(s: CrawlStatus): BadgeVariant {
	switch (s) {
		case 'done':
			return 'success'
		case 'running':
			return 'default'
		case 'failed':
			return 'destructive'
		case 'cancelled':
		case 'skipped':
			return 'secondary'
		default:
			return 'warning'
	}
}

// Notify: ok=true renders a green success toast, otherwise a red error toast.
type Notify = (msg: string, ok?: boolean) => void

type NodeDef =
	| { kind: 'country'; id: number; name: string }
	| { kind: 'competition'; id: string; name: string; ctype: string }
	| { kind: 'team'; id: number; name: string; teamKind: 'national' | 'club' }

function rowIcon(n: NodeDef) {
	if (n.kind === 'country') return <Flag className="h-4 w-4 text-sky-600" />
	if (n.kind === 'competition') return <Trophy className="h-4 w-4 text-amber-600" />
	return n.teamKind === 'national' ? (
		<Shield className="h-4 w-4 text-emerald-600" />
	) : (
		<Users className="h-4 w-4 text-violet-600" />
	)
}

function TreeRow({
	node,
	depth,
	notify,
	api,
	onView,
}: {
	node: NodeDef
	depth: number
	notify: Notify
	api: SpiderApi
	onView: (t: DataTarget) => void
}) {
	const [open, setOpen] = useState(false)
	const [loading, setLoading] = useState(false)
	const [children, setChildren] = useState<NodeDef[] | null>(null)

	const expandable = node.kind === 'country' || node.kind === 'competition'

	async function toggle() {
		if (!expandable) return
		const next = !open
		setOpen(next)
		if (next && children === null) {
			setLoading(true)
			try {
				if (node.kind === 'country') {
					const [nts, comps] = await Promise.all([
						api.nationalTeams(node.id),
						api.countryCompetitions(node.id),
					])
					setChildren([
						...nts.map(
							(t): NodeDef => ({
								kind: 'team',
								id: t.id,
								name: t.name,
								teamKind: 'national',
							}),
						),
						...comps.map(
							(c): NodeDef => ({
								kind: 'competition',
								id: c.id,
								name: c.name,
								ctype: c.type,
							}),
						),
					])
				} else if (node.kind === 'competition') {
					const teams = await api.competitionTeams(node.id)
					setChildren(
						teams.map(
							(t): NodeDef => ({
								kind: 'team',
								id: t.id,
								name: t.name,
								teamKind: 'club',
							}),
						),
					)
				}
			} catch (e) {
				notify(`展开失败: ${(e as Error).message}`, false)
				setChildren([])
			} finally {
				setLoading(false)
			}
		}
	}

	async function crawl(kind: CrawlKind, targetId: string) {
		try {
			const r = await api.enqueue({ kind, target_id: targetId })
			notify(`已入队 ${KIND_LABEL[kind]} × ${r.enqueued} 季`, true)
		} catch (e) {
			notify(`入队失败: ${(e as Error).message}`, false)
		}
	}

	return (
		<div>
			<div
				className="group flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-accent"
				style={{ paddingLeft: depth * 16 + 6 }}
			>
				<button
					onClick={toggle}
					className={
						'flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground ' +
						(expandable ? '' : 'invisible')
					}
				>
					{loading ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : open ? (
						<ChevronDown className="h-3.5 w-3.5" />
					) : (
						<ChevronRight className="h-3.5 w-3.5" />
					)}
				</button>
				{rowIcon(node)}
				<span className="truncate text-sm">{node.name}</span>
				{node.kind === 'competition' && (
					<Badge variant="outline" className="ml-1 shrink-0">
						{TYPE_LABEL[node.ctype] ?? node.ctype}
					</Badge>
				)}
				<span className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
					{node.kind === 'competition' && (
						<>
							<Button
								variant="ghost"
								className="h-6 px-2 text-xs"
								onClick={() => onView({ kind: 'competition', id: node.id, name: node.name })}
							>
								<Eye className="mr-1 h-3.5 w-3.5" />
								查看
							</Button>
							<Button
								variant="secondary"
								className="h-6 px-2 text-xs"
								onClick={() => crawl('competition_clubs', node.id)}
							>
								抓参赛队
							</Button>
							<Button
								variant="secondary"
								className="h-6 px-2 text-xs"
								onClick={() => crawl('competition_standings', node.id)}
							>
								抓积分榜
							</Button>
							<Button
								variant="secondary"
								className="h-6 px-2 text-xs"
								onClick={() => crawl('competition_fixtures', node.id)}
							>
								抓赛程
							</Button>
						</>
					)}
					{node.kind === 'team' && (
						<>
							<Button
								variant="ghost"
								className="h-6 px-2 text-xs"
								onClick={() => onView({ kind: 'team', id: node.id, name: node.name })}
							>
								<Eye className="mr-1 h-3.5 w-3.5" />
								查看
							</Button>
							<Button
								variant="secondary"
								className="h-6 px-2 text-xs"
								onClick={() => crawl('team_squad', String(node.id))}
							>
								抓阵容
							</Button>
							<Button
								variant="secondary"
								className="h-6 px-2 text-xs"
								onClick={() => crawl('team_fixtures', String(node.id))}
							>
								抓赛程
							</Button>
						</>
					)}
				</span>
			</div>
			{open &&
				children?.map((c) => (
					<TreeRow
						key={`${c.kind}:${c.id}`}
						node={c}
						depth={depth + 1}
						notify={notify}
						api={api}
						onView={onView}
					/>
				))}
		</div>
	)
}

export function CrawlerPage() {
	const { token } = useAuth()
	const { showToast } = useToast()
	const api = useMemo(() => createSpiderApi(token), [token])
	const [countries, setCountries] = useState<Country[]>([])
	const [loading, setLoading] = useState(true)
	const [q, setQ] = useState('')
	const [tasks, setTasks] = useState<CrawlTask[]>([])
	const [needsVerify, setNeedsVerify] = useState(false)
	const [viewTarget, setViewTarget] = useState<DataTarget | null>(null)

	const notify: Notify = (msg, ok = false) =>
		showToast({ title: msg, tone: ok ? 'success' : 'error' })

	useEffect(() => {
		api
			.countries()
			.then(setCountries)
			.catch((e) => notify(`加载国家失败: ${(e as Error).message}`, false))
			.finally(() => setLoading(false))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [api])

	useEffect(() => {
		let active = true
		const tick = async () => {
			try {
				const [t, b] = await Promise.all([api.tasks(), api.browserStatus()])
				if (!active) return
				setTasks(t)
				setNeedsVerify(b.needs_verification)
			} catch {
				/* ignore transient polling errors */
			}
		}
		tick()
		const id = setInterval(tick, 2000)
		return () => {
			active = false
			clearInterval(id)
		}
	}, [api])

	const filtered = q
		? countries.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
		: countries

	const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'running').length

	return (
		<div className="flex flex-1 flex-col gap-4">
			<div className="flex items-center gap-3">
				<span className="text-2xl">🕷️</span>
				<div>
					<h1 className="text-lg font-semibold">爬虫 · Transfermarkt Spider</h1>
					<p className="text-xs text-muted-foreground">
						展开国家 → 国家队/赛事,逐层选择抓取(默认近 5 季,全局 QPS &lt; 1)
					</p>
				</div>
			</div>

			{needsVerify && (
				<div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-700">
					<AlertTriangle className="h-4 w-4 shrink-0" />
					需要人工验证:请在服务器端完成人机验证(或确认 2captcha 有余额),抓取会自动继续。
				</div>
			)}

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<section className="space-y-4 lg:col-span-2">
					<Card>
						<CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
							<CardTitle className="text-base">
								选择树
								<span className="ml-2 text-sm font-normal text-muted-foreground">
									{countries.length} 个国家
								</span>
							</CardTitle>
							<Button
								variant="outline"
								className="h-7 text-xs"
								onClick={() =>
									api
										.enqueueFallback()
										.then(() => notify('已入队兜底发现(fifa + 洲际杯)', true))
										.catch((e) => notify((e as Error).message, false))
								}
							>
								兜底发现
							</Button>
						</CardHeader>
						<CardContent>
							<div className="relative mb-3">
								<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									className="pl-8"
									placeholder="搜索国家…"
									value={q}
									onChange={(e) => setQ(e.target.value)}
								/>
							</div>
							{loading ? (
								<div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
									<Loader2 className="h-4 w-4 animate-spin" /> 加载国家列表…
								</div>
							) : (
								<div className="max-h-[70vh] overflow-y-auto rounded-md border">
									{filtered.map((c) => (
										<TreeRow
											key={c.id}
											node={{ kind: 'country', id: c.id, name: c.name }}
											depth={0}
											notify={notify}
											api={api}
											onView={setViewTarget}
										/>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</section>

				<section className="space-y-4">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">
								抓取任务
								<span className="ml-2 text-sm font-normal text-muted-foreground">
									{pending} 待处理
								</span>
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							{tasks.length === 0 && (
								<p className="py-6 text-center text-sm text-muted-foreground">还没有任务</p>
							)}
							{tasks.map((t) => (
								<div key={t.id} className="rounded-md border p-2.5">
									<div className="mb-1 flex items-center justify-between gap-2">
										<div className="flex items-center gap-1.5 text-sm font-medium">
											<span>{KIND_LABEL[t.kind]}</span>
											<span className="text-muted-foreground">{t.target_id}</span>
											{t.season_id > 0 && (
												<span className="flex items-center gap-0.5 text-xs text-muted-foreground">
													<CalendarDays className="h-3 w-3" />
													{t.season_id}
												</span>
											)}
										</div>
										<Badge variant={statusVariant(t.status)}>{t.status}</Badge>
									</div>
									{(t.message || t.last_error) && (
										<div
											className={
												'text-xs ' +
												(t.last_error ? 'text-destructive' : 'text-muted-foreground')
											}
										>
											{t.last_error ?? t.message}
										</div>
									)}
								</div>
							))}
						</CardContent>
					</Card>
				</section>
			</div>

			<CrawlerDataDialog
				target={viewTarget}
				open={viewTarget !== null}
				onOpenChange={(v) => !v && setViewTarget(null)}
				api={api}
			/>
		</div>
	)
}

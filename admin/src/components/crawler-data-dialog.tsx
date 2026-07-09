// A read-only viewer for data the crawler has already stored: competition
// standings / fixtures and team squad / fixtures. Opened from a row in the
// crawler selection tree so, after a task finishes, the result can be browsed
// without leaving the admin console.

import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import {
	type Fixture,
	type Player,
	type SpiderApi,
	type Standing,
	formatMarketValue,
} from '@/lib/spider-api'

export type DataTarget =
	| { kind: 'competition'; id: string; name: string }
	| { kind: 'team'; id: number; name: string }

type Tab = 'standings' | 'fixtures' | 'squad'

// The last `n` Transfermarkt saison_id years (current season first), mirroring
// the backend's crawler.recent_seasons() so the picker offers the seasons the
// default crawl actually populated.
function recentSeasons(n = 8): { id: number; label: string }[] {
	const now = new Date()
	const cur = now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1
	return Array.from({ length: n }, (_, i) => {
		const y = cur - i
		return { id: y, label: `${y}/${String((y + 1) % 100).padStart(2, '0')}` }
	})
}

function fmtKickoff(iso: string | null): string {
	if (!iso) return '—'
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return iso
	return d.toLocaleString('zh-CN', {
		year: '2-digit',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	})
}

export function CrawlerDataDialog({
	target,
	open,
	onOpenChange,
	api,
}: {
	target: DataTarget | null
	open: boolean
	onOpenChange: (v: boolean) => void
	api: SpiderApi
}) {
	const seasons = useMemo(() => recentSeasons(), [])
	const [season, setSeason] = useState(seasons[0].id)
	const [tab, setTab] = useState<Tab>('fixtures')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [standings, setStandings] = useState<Standing[]>([])
	const [fixtures, setFixtures] = useState<Fixture[]>([])
	const [squad, setSquad] = useState<Player[]>([])
	// team_id -> name, so standings (which only carry team_id) stay readable.
	const [teamNames, setTeamNames] = useState<Record<number, string>>({})

	const isComp = target?.kind === 'competition'

	// Reset the active tab whenever the target changes to one whose default view
	// differs (competitions lead with standings, teams with fixtures).
	useEffect(() => {
		if (!target) return
		setTab(target.kind === 'competition' ? 'standings' : 'fixtures')
	}, [target])

	// For competitions, fetch the roster once to label standings/fixtures rows.
	useEffect(() => {
		if (!open || target?.kind !== 'competition') return
		let active = true
		api
			.competitionTeams(target.id)
			.then((ts) => {
				if (!active) return
				setTeamNames(Object.fromEntries(ts.map((t) => [t.id, t.name])))
			})
			.catch(() => {})
		return () => {
			active = false
		}
	}, [open, target, api])

	useEffect(() => {
		if (!open || !target) return
		let active = true
		setLoading(true)
		setError(null)
		const run = async () => {
			try {
				if (target.kind === 'competition') {
					if (tab === 'standings') setStandings(await api.standings(target.id, season))
					else setFixtures(await api.competitionFixtures(target.id, season))
				} else if (tab === 'squad') {
					setSquad(await api.squad(target.id, season))
				} else {
					setFixtures(await api.fixtures(target.id, season))
				}
			} catch (e) {
				if (active) setError((e as Error).message)
			} finally {
				if (active) setLoading(false)
			}
		}
		run()
		return () => {
			active = false
		}
	}, [open, target, tab, season, api])

	const teamLabel = (id: number | null) =>
		id == null ? '—' : (teamNames[id] ?? String(id))

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-base">
						<span className="truncate">{target?.name}</span>
						<span className="text-xs font-normal text-muted-foreground">已抓取数据</span>
					</DialogTitle>
				</DialogHeader>

				<div className="flex items-center justify-between gap-3">
					<Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
						<TabsList>
							{isComp ? (
								<>
									<TabsTrigger value="standings">积分榜</TabsTrigger>
									<TabsTrigger value="fixtures">赛程</TabsTrigger>
								</>
							) : (
								<>
									<TabsTrigger value="fixtures">赛程</TabsTrigger>
									<TabsTrigger value="squad">阵容</TabsTrigger>
								</>
							)}
						</TabsList>
					</Tabs>
					<Select value={String(season)} onValueChange={(v) => setSeason(Number(v))}>
						<SelectTrigger className="h-8 w-28">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{seasons.map((s) => (
								<SelectItem key={s.id} value={String(s.id)}>
									{s.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="max-h-[60vh] min-h-[8rem] overflow-auto rounded-md border">
					{loading ? (
						<div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" /> 加载中…
						</div>
					) : error ? (
						<div className="p-6 text-sm text-destructive">加载失败: {error}</div>
					) : tab === 'standings' ? (
						<StandingsTable rows={standings} teamLabel={teamLabel} />
					) : tab === 'squad' ? (
						<SquadTable rows={squad} />
					) : (
						<FixturesTable rows={fixtures} isComp={isComp} teamLabel={teamLabel} />
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}

function Empty({ text }: { text: string }) {
	return <div className="p-6 text-center text-sm text-muted-foreground">{text}</div>
}

function StandingsTable({
	rows,
	teamLabel,
}: {
	rows: Standing[]
	teamLabel: (id: number | null) => string
}) {
	if (rows.length === 0) return <Empty text="该赛季暂无积分榜数据" />
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="w-10">#</TableHead>
					<TableHead>球队</TableHead>
					<TableHead className="w-10 text-center">场</TableHead>
					<TableHead className="w-10 text-center">胜</TableHead>
					<TableHead className="w-10 text-center">平</TableHead>
					<TableHead className="w-10 text-center">负</TableHead>
					<TableHead className="w-16 text-center">进/失</TableHead>
					<TableHead className="w-12 text-center">净</TableHead>
					<TableHead className="w-12 text-center">分</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((s, i) => (
					<TableRow key={`${s.group}:${s.team_id}:${i}`}>
						<TableCell className="text-muted-foreground">{s.rank ?? '—'}</TableCell>
						<TableCell className="font-medium">{teamLabel(s.team_id)}</TableCell>
						<TableCell className="text-center">{s.played ?? '—'}</TableCell>
						<TableCell className="text-center">{s.win ?? '—'}</TableCell>
						<TableCell className="text-center">{s.draw ?? '—'}</TableCell>
						<TableCell className="text-center">{s.loss ?? '—'}</TableCell>
						<TableCell className="text-center">
							{s.goals_for ?? '—'}:{s.goals_against ?? '—'}
						</TableCell>
						<TableCell className="text-center">{s.goal_diff ?? '—'}</TableCell>
						<TableCell className="text-center font-semibold">{s.points ?? '—'}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	)
}

function FixturesTable({
	rows,
	isComp,
	teamLabel,
}: {
	rows: Fixture[]
	isComp: boolean
	teamLabel: (id: number | null) => string
}) {
	if (rows.length === 0) return <Empty text="该赛季暂无赛程数据" />
	const name = (id: number | null, fallback: string | null) =>
		fallback ?? (isComp ? teamLabel(id) : id == null ? '—' : String(id))
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="w-16">轮次</TableHead>
					<TableHead className="w-32">时间</TableHead>
					<TableHead className="text-right">主队</TableHead>
					<TableHead className="w-16 text-center">比分</TableHead>
					<TableHead>客队</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((f) => (
					<TableRow key={f.id}>
						<TableCell className="text-muted-foreground">{f.matchday ?? '—'}</TableCell>
						<TableCell className="text-xs text-muted-foreground">{fmtKickoff(f.kickoff)}</TableCell>
						<TableCell className="text-right font-medium">
							{name(f.home_team_id, f.home_name)}
						</TableCell>
						<TableCell className="text-center tabular-nums">
							{f.home_score == null || f.away_score == null
								? '—'
								: `${f.home_score} : ${f.away_score}`}
						</TableCell>
						<TableCell className="font-medium">{name(f.away_team_id, f.away_name)}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	)
}

function SquadTable({ rows }: { rows: Player[] }) {
	if (rows.length === 0) return <Empty text="该赛季暂无阵容数据" />
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>姓名</TableHead>
					<TableHead className="w-28">位置</TableHead>
					<TableHead className="w-24">国籍</TableHead>
					<TableHead className="w-20 text-center">身高</TableHead>
					<TableHead className="w-16 text-center">惯用脚</TableHead>
					<TableHead className="w-24 text-right">身价</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((p) => (
					<TableRow key={p.id}>
						<TableCell className="font-medium">{p.name}</TableCell>
						<TableCell className="text-muted-foreground">{p.position ?? '—'}</TableCell>
						<TableCell className="text-muted-foreground">{p.nationality ?? '—'}</TableCell>
						<TableCell className="text-center">{p.height_cm ? `${p.height_cm}cm` : '—'}</TableCell>
						<TableCell className="text-center">{p.foot ?? '—'}</TableCell>
						<TableCell className="text-right tabular-nums">
							{formatMarketValue(p.market_value)}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	)
}

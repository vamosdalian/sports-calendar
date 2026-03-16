import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '@/components/auth-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import type { MatchItem, SeasonDetailResponse, SeasonReference } from '@/types'

function displayText(value: string | Record<string, string> | undefined) {
	if (!value) {
		return '-'
	}
	if (typeof value === 'string') {
		return value
	}
	return value.zh || value.en || Object.values(value)[0] || '-'
}

function countMatches(detail: SeasonDetailResponse | null) {
	if (!detail) {
		return 0
	}
	return detail.groups.reduce((total, group) => total + group.matches.length, 0)
}

export function SeasonsPage() {
	const { sportSlug = '', leagueSlug = '' } = useParams()
	const { token } = useAuth()
	const [seasons, setSeasons] = useState<SeasonReference[]>([])
	const [selectedSeason, setSelectedSeason] = useState<string>('')
	const [detail, setDetail] = useState<SeasonDetailResponse | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [pending, setPending] = useState(false)
	const [form, setForm] = useState({ slug: '', label: '', startYear: '', endYear: '', defaultMatchDurationMinutes: '120' })

	const loadSeasons = useCallback(async (nextSelectedSeason?: string) => {
		const response = await api.listSeasons(sportSlug, leagueSlug)
		setSeasons(response.seasons)
		const seasonSlug = nextSelectedSeason ?? response.seasons[0]?.slug ?? ''
		setSelectedSeason(seasonSlug)
		if (seasonSlug) {
			setDetail(await api.getSeasonDetail(sportSlug, leagueSlug, seasonSlug))
		} else {
			setDetail(null)
		}
	}, [leagueSlug, sportSlug])

	useEffect(() => {
		if (!sportSlug || !leagueSlug) {
			return
		}
		void loadSeasons().catch((caught) => setError(caught instanceof Error ? caught.message : 'load failed'))
	}, [loadSeasons, sportSlug, leagueSlug])

	async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!token) {
			return
		}
		setPending(true)
		setError(null)
		try {
			await api.createSeason(token, {
				sportSlug,
				leagueSlug,
				slug: form.slug,
				label: form.label,
				startYear: Number(form.startYear),
				endYear: Number(form.endYear),
				defaultMatchDurationMinutes: Number(form.defaultMatchDurationMinutes),
			})
			const createdSlug = form.slug
			setForm({ slug: '', label: '', startYear: '', endYear: '', defaultMatchDurationMinutes: '120' })
			await loadSeasons(createdSlug)
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'create failed')
		} finally {
			setPending(false)
		}
	}

	async function handleDelete(seasonSlug: string) {
		if (!token) {
			return
		}
		setPending(true)
		setError(null)
		try {
			await api.deleteSeason(token, sportSlug, leagueSlug, seasonSlug)
			await loadSeasons()
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'delete failed')
		} finally {
			setPending(false)
		}
	}

	async function handleSelectSeason(seasonSlug: string) {
		setSelectedSeason(seasonSlug)
		setDetail(await api.getSeasonDetail(sportSlug, leagueSlug, seasonSlug))
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line/70 bg-white px-5 py-4">
				<div>
					<p className="text-xs uppercase tracking-[0.16em] text-muted">Catalog path</p>
					<h1 className="mt-2 text-2xl font-semibold text-ink">Sports / {sportSlug} / Leagues / {leagueSlug} / Seasons</h1>
					<p className="mt-1 text-sm text-muted">Create seasons, inspect fixtures, and return to the league list when needed.</p>
				</div>
				<div className="flex items-center gap-3">
					<Badge>Step 3 of 3</Badge>
					<Button asChild size="sm" variant="outline"><Link to={`/sports/${sportSlug}/leagues`}>Back to leagues</Link></Button>
				</div>
			</div>
			<Card>
				<CardHeader>
					<Badge>{leagueSlug}</Badge>
					<CardTitle className="mt-4">Create season</CardTitle>
					<CardDescription>Create or delete seasons and inspect the full match schedule below.</CardDescription>
				</CardHeader>
				<CardContent>
					<form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleCreate}>
						<div><Label htmlFor="season-slug">Slug</Label><Input id="season-slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} /></div>
						<div><Label htmlFor="season-label">Label</Label><Input id="season-label" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} /></div>
						<div><Label htmlFor="season-start">Start year</Label><Input id="season-start" value={form.startYear} onChange={(event) => setForm((current) => ({ ...current, startYear: event.target.value }))} /></div>
						<div><Label htmlFor="season-end">End year</Label><Input id="season-end" value={form.endYear} onChange={(event) => setForm((current) => ({ ...current, endYear: event.target.value }))} /></div>
						<div><Label htmlFor="season-duration">Duration minutes</Label><Input id="season-duration" value={form.defaultMatchDurationMinutes} onChange={(event) => setForm((current) => ({ ...current, defaultMatchDurationMinutes: event.target.value }))} /></div>
						<div className="md:col-span-2 xl:col-span-5"><Button disabled={pending} type="submit">{pending ? 'Saving...' : 'Create season'}</Button></div>
					</form>
					{error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
				</CardContent>
			</Card>
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Season list</CardTitle>
						<CardDescription>Select a season to inspect all matches returned by the public season endpoint.</CardDescription>
					</CardHeader>
					<CardContent className="overflow-x-auto">
						<Table>
							<TableHead><TableRow><TableHeaderCell>Slug</TableHeaderCell><TableHeaderCell>Label</TableHeaderCell><TableHeaderCell>Action</TableHeaderCell></TableRow></TableHead>
							<TableBody>
								{seasons.map((season) => (
									<TableRow key={season.slug} className={season.slug === selectedSeason ? 'bg-shell/70' : ''}>
										<TableCell className="font-mono text-xs">{season.slug}</TableCell>
										<TableCell>{season.label}</TableCell>
										<TableCell className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void handleSelectSeason(season.slug)} type="button">Inspect fixtures</Button><Button size="sm" variant="danger" onClick={() => void handleDelete(season.slug)} type="button">Delete</Button></TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Season fixtures</CardTitle>
						<CardDescription>{detail ? `${detail.seasonLabel} · ${countMatches(detail)} matches` : 'Select a season to inspect its full schedule.'}</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{detail ? (
							<>
								<div className="space-y-4">
									<div className="rounded-lg bg-shell px-4 py-4"><p className="text-xs uppercase tracking-[0.16em] text-muted">Description</p><p className="mt-2 text-sm">{displayText(detail.calendarDescription)}</p></div>
									<div className="rounded-lg bg-shell px-4 py-4"><p className="text-xs uppercase tracking-[0.16em] text-muted">Data source</p><p className="mt-2 text-sm">{displayText(detail.dataSourceNote)}</p></div>
									<div className="rounded-lg bg-shell px-4 py-4"><p className="text-xs uppercase tracking-[0.16em] text-muted">Notes</p><p className="mt-2 text-sm">{displayText(detail.notes)}</p></div>
								</div>
								<div className="space-y-4">
									{detail.groups.map((group) => (
										<div key={group.key} className="rounded-lg border border-line/70">
											<div className="border-b border-line/70 bg-shell/70 px-4 py-3"><p className="font-semibold text-ink">{displayText(group.label)}</p></div>
											<div className="divide-y divide-line/60">{group.matches.map((match) => <MatchRow key={match.id} match={match} />)}</div>
										</div>
									))}
								</div>
							</>
						) : (
							<p className="text-sm text-muted">No season selected yet.</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	)
}

function MatchRow({ match }: { match: MatchItem }) {
	return (
		<div className="grid gap-2 px-4 py-4 md:grid-cols-[1.1fr_0.9fr_0.6fr_0.8fr] md:items-center">
			<div><p className="font-medium text-ink">{displayText(match.homeTeam?.name)} vs {displayText(match.awayTeam?.name)}</p><p className="mt-1 font-mono text-xs text-muted">{match.id}</p></div>
			<div><p className="text-sm text-ink">{new Date(match.startsAt).toLocaleString()}</p><p className="mt-1 text-xs text-muted">{displayText(match.venue)} · {displayText(match.city)}</p></div>
			<div><Badge className="bg-shell text-ink">{match.status}</Badge></div>
			<div className="text-sm text-muted">{displayText(match.round)}</div>
		</div>
	)
}
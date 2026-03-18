import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AddSeasonDialog } from '@/components/add-season-dialog'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { EditSeasonDialog } from '@/components/edit-season-dialog'
import { useAuth } from '@/components/use-auth'
import { useToast } from '@/components/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import type { AdminSeasonItem, MatchItem, SeasonDetailResponse } from '@/types'

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
	const { showToast } = useToast()
	const [seasons, setSeasons] = useState<AdminSeasonItem[]>([])
	const [selectedSeason, setSelectedSeason] = useState<string>('')
	const [detail, setDetail] = useState<SeasonDetailResponse | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [createOpen, setCreateOpen] = useState(false)
	const [editingSeason, setEditingSeason] = useState<AdminSeasonItem | null>(null)
	const [deletingSeason, setDeletingSeason] = useState<AdminSeasonItem | null>(null)
	const [deletePending, setDeletePending] = useState(false)
	const [deleteError, setDeleteError] = useState<string | null>(null)

	const loadSeasons = useCallback(async (nextSelectedSeason?: string) => {
		if (!token) {
			return
		}
		const response = await api.listAdminSeasons(token, sportSlug, leagueSlug)
		setSeasons(response.items)
		const seasonSlug = nextSelectedSeason ?? response.items[0]?.slug ?? ''
		setSelectedSeason(seasonSlug)
		if (seasonSlug) {
			setDetail(await api.getSeasonDetail(sportSlug, leagueSlug, seasonSlug))
		} else {
			setDetail(null)
		}
	}, [leagueSlug, sportSlug, token])

	useEffect(() => {
		if (!sportSlug || !leagueSlug) {
			return
		}
		let active = true
		async function hydrate() {
			try {
				await loadSeasons()
				if (active) {
					setError(null)
				}
			} catch (caught) {
				if (active) {
					setError(caught instanceof Error ? caught.message : 'load failed')
				}
			}
		}
		void hydrate()
		return () => {
			active = false
		}
	}, [loadSeasons, sportSlug, leagueSlug])

	async function handleDeleteSeason() {
		if (!token || !deletingSeason) {
			return
		}
		setDeletePending(true)
		setDeleteError(null)
		try {
			await api.deleteSeason(token, sportSlug, leagueSlug, deletingSeason.slug)
			await loadSeasons()
			setDeletingSeason(null)
			showToast({ title: 'Season deleted', description: `${deletingSeason.slug} was removed from the local catalog.`, tone: 'success' })
		} catch (caught) {
			setDeleteError(caught instanceof Error ? caught.message : 'delete failed')
		} finally {
			setDeletePending(false)
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
					<CardDescription>Choose a remote season for this league in a dialog, then keep using the existing fixture inspector below.</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/70 bg-shell/55 px-4 py-4">
						<p className="text-sm text-muted">The create form now opens in a dialog and preloads candidate seasons from TheSportsDB for the current league.</p>
						<Button onClick={() => setCreateOpen(true)} type="button">Add season</Button>
					</div>
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
										<TableCell className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void handleSelectSeason(season.slug)} type="button">Inspect fixtures</Button><Button size="sm" variant="outline" onClick={() => setEditingSeason(season)} type="button">Edit</Button><Button size="sm" variant="danger" onClick={() => { setDeleteError(null); setDeletingSeason(season) }} type="button">Delete</Button></TableCell>
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
			<AddSeasonDialog
				sportSlug={sportSlug}
				leagueSlug={leagueSlug}
				open={createOpen}
				onOpenChange={setCreateOpen}
				onCreated={async (seasonSlug) => {
					await loadSeasons(seasonSlug)
					showToast({ title: 'Season created', description: `${seasonSlug} is ready for fixture inspection.`, tone: 'success' })
				}}
			/>
			<EditSeasonDialog season={editingSeason} open={editingSeason !== null} onOpenChange={(open) => { if (!open) { setEditingSeason(null) } }} onSaved={async (seasonSlug) => { await loadSeasons(seasonSlug); showToast({ title: 'Season updated', description: 'Season metadata was saved.', tone: 'success' }) }} />
			<ConfirmActionDialog
				open={deletingSeason !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeletingSeason(null)
						setDeleteError(null)
					}
				}}
				title="Delete season"
				description={deletingSeason ? `Delete ${deletingSeason.slug} and all matches stored under it?` : 'Delete this season?'}
				confirmLabel="Delete season"
				pendingLabel="Deleting..."
				onConfirm={handleDeleteSeason}
				pending={deletePending}
				error={deleteError}
			/>
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
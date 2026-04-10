import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AddMatchDialog } from '@/components/add-match-dialog'
import { CatalogDataTable } from '@/components/catalog-data-table'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { useAuth } from '@/components/use-auth'
import { useToast } from '@/components/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import type { MatchItem, SeasonDetailResponse } from '@/types'

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

type MatchTableRow = {
	match: MatchItem
	id: string
	round: string
	startsAt: string
	status: string
	homeTeam: string
	awayTeam: string
	venue: string
	city: string
	country: string
	groupLabel: string
	isManual: boolean
}

export function MatchesPage() {
	const { sportSlug = '', leagueSlug = '', seasonSlug = '' } = useParams()
	const { token } = useAuth()
	const { showToast } = useToast()
	const [detail, setDetail] = useState<SeasonDetailResponse | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [refreshing, setRefreshing] = useState(false)
	const [addDialogOpen, setAddDialogOpen] = useState(false)
	const [editingMatch, setEditingMatch] = useState<MatchItem | null>(null)
	const [deletingMatch, setDeletingMatch] = useState<MatchItem | null>(null)
	const [deletePending, setDeletePending] = useState(false)
	const [deleteError, setDeleteError] = useState<string | null>(null)

	const loadSeasonDetail = useCallback(async () => {
		const response = await api.getSeasonDetail(sportSlug, leagueSlug, seasonSlug)
		setDetail(response)
	}, [leagueSlug, seasonSlug, sportSlug])

	useEffect(() => {
		if (!sportSlug || !leagueSlug || !seasonSlug) {
			return
		}
		let active = true
		async function hydrate() {
			try {
				await loadSeasonDetail()
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
	}, [leagueSlug, loadSeasonDetail, seasonSlug, sportSlug])

	async function handleRefresh() {
		if (!token) {
			return
		}
		setRefreshing(true)
		try {
			await api.refreshSeasonSchedule(token, sportSlug, leagueSlug, seasonSlug)
			await loadSeasonDetail()
			showToast({ title: 'Season refreshed', description: `${seasonSlug} fixtures were fetched immediately.`, tone: 'success' })
		} catch (caught) {
			showToast({ title: 'Refresh failed', description: caught instanceof Error ? caught.message : 'refresh failed', tone: 'error' })
		} finally {
			setRefreshing(false)
		}
	}

	async function handleDeleteMatch() {
		if (!token || !deletingMatch) {
			return
		}
		setDeletePending(true)
		setDeleteError(null)
		try {
			await api.deleteMatch(token, sportSlug, leagueSlug, seasonSlug, deletingMatch.id)
			await loadSeasonDetail()
			showToast({ title: 'Match deleted', description: 'The manual fixture was removed from this season.', tone: 'success' })
			setDeletingMatch(null)
		} catch (caught) {
			setDeleteError(caught instanceof Error ? caught.message : 'delete failed')
		} finally {
			setDeletePending(false)
		}
	}

	const rows = useMemo<MatchTableRow[]>(() => {
		if (!detail) {
			return []
		}
		return detail.groups.flatMap((group) =>
			group.matches.map((match) => ({
				match,
				id: match.id,
				round: displayText(match.round),
				startsAt: match.startsAt,
				status: match.status,
				homeTeam: displayText(match.homeTeam?.name),
				awayTeam: displayText(match.awayTeam?.name),
				venue: displayText(match.venue),
				city: displayText(match.city),
				country: displayText(match.country),
				groupLabel: displayText(group.label),
				isManual: match.id.startsWith('manual:'),
			}))
		)
	}, [detail])

	return (
		<div className="space-y-6">
			<AddMatchDialog
				sportSlug={sportSlug}
				leagueSlug={leagueSlug}
				seasonSlug={seasonSlug}
				open={addDialogOpen}
				onOpenChange={setAddDialogOpen}
				onSaved={async () => {
					await loadSeasonDetail()
					showToast({ title: 'Match created', description: 'The manual fixture is now part of this season.', tone: 'success' })
				}}
			/>
			<AddMatchDialog
				sportSlug={sportSlug}
				leagueSlug={leagueSlug}
				seasonSlug={seasonSlug}
				match={editingMatch}
				open={editingMatch !== null}
				onOpenChange={(open) => {
					if (!open) {
						setEditingMatch(null)
					}
				}}
				onSaved={async () => {
					await loadSeasonDetail()
					showToast({ title: 'Match updated', description: 'The manual fixture changes were saved.', tone: 'success' })
					setEditingMatch(null)
				}}
			/>
			<Card className="demo-panel">
				<CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
					<div>
						<CardTitle>Matches</CardTitle>
						<CardDescription>
							{detail ? `${detail.seasonLabel} · ${countMatches(detail)} matches` : `Season ${seasonSlug}`}
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<Button asChild type="button" variant="outline">
							<Link to={`/sports/${sportSlug}/leagues/${leagueSlug}/seasons`}>Back to seasons</Link>
						</Button>
						<Button onClick={() => setAddDialogOpen(true)} type="button" variant="outline">
							Add match
						</Button>
						<Button disabled={refreshing} onClick={() => void handleRefresh()} type="button">
							{refreshing ? 'Refreshing...' : 'Refresh now'}
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{error ? <p className="text-sm text-danger">{error}</p> : null}
				</CardContent>
			</Card>
			<Card className="demo-panel">
				<CardHeader>
					<CardTitle>Match list</CardTitle>
					<CardDescription>Browse all matches for this season.</CardDescription>
				</CardHeader>
				<CardContent>
					<CatalogDataTable
						columns={[
							{ id: 'match', header: 'Match', cell: (row) => <div><div className="flex items-center gap-2"><p className="font-medium text-foreground">{row.homeTeam} vs {row.awayTeam}</p>{row.isManual ? <Badge variant="outline" className="px-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Manual</Badge> : null}</div><p className="mt-1 font-mono text-xs text-muted-foreground">{row.id}</p></div>, headerClassName: 'min-w-72' },
							{ id: 'kickoff', header: 'Kickoff', cell: (row) => new Date(row.startsAt).toLocaleString(), cellClassName: 'text-muted-foreground min-w-44' },
							{ id: 'round', header: 'Round', cell: (row) => <div><p>{row.round}</p><p className="mt-1 text-xs text-muted-foreground">{row.groupLabel}</p></div>, cellClassName: 'min-w-36' },
							{ id: 'venue', header: 'Venue', cell: (row) => <div><p>{row.venue}</p><p className="mt-1 text-xs text-muted-foreground">{[row.city, row.country].filter((value) => value && value !== '-').join(', ') || '-'}</p></div>, cellClassName: 'min-w-40' },
							{ id: 'status', header: 'Status', cell: (row) => <Badge variant="outline" className="px-1.5 text-muted-foreground">{row.status}</Badge>, cellClassName: 'w-28' },
						]}
						rows={rows}
						getRowId={(row) => row.id}
						getSearchText={(row) => `${row.homeTeam} ${row.awayTeam} ${row.round} ${row.groupLabel} ${row.venue} ${row.city} ${row.country} ${row.status}`}
						searchPlaceholder="Filter matches..."
						emptyMessage="No matches found."
						renderRowActions={(row) => row.isManual ? (
							<>
								<DropdownMenuItem onSelect={() => setEditingMatch(row.match)}>Edit</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive focus:text-destructive"
									onSelect={() => {
										setDeleteError(null)
										setDeletingMatch(row.match)
									}}
								>
									Delete
								</DropdownMenuItem>
							</>
						) : null}
					/>
				</CardContent>
			</Card>
			<ConfirmActionDialog
				open={deletingMatch !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeletingMatch(null)
						setDeleteError(null)
					}
				}}
				title="Delete match"
				description={deletingMatch ? `Delete manual fixture ${deletingMatch.id}? This does not affect synced matches.` : 'Delete this manual fixture?'}
				confirmLabel="Delete match"
				pendingLabel="Deleting..."
				onConfirm={handleDeleteMatch}
				pending={deletePending}
				error={deleteError}
			/>
		</div>
	)
}
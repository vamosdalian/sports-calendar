import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { CatalogDataTable } from '@/components/catalog-data-table'
import { useAuth } from '@/components/use-auth'
import { useToast } from '@/components/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { SeasonDetailResponse } from '@/types'

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
	id: string
	round: string
	startsAt: string
	status: string
	homeTeam: string
	awayTeam: string
	venue: string
	city: string
	groupLabel: string
}

export function MatchesPage() {
	const { sportSlug = '', leagueSlug = '', seasonSlug = '' } = useParams()
	const { token } = useAuth()
	const { showToast } = useToast()
	const [detail, setDetail] = useState<SeasonDetailResponse | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [refreshing, setRefreshing] = useState(false)

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

	const rows = useMemo<MatchTableRow[]>(() => {
		if (!detail) {
			return []
		}
		return detail.groups.flatMap((group) =>
			group.matches.map((match) => ({
				id: match.id,
				round: displayText(match.round),
				startsAt: match.startsAt,
				status: match.status,
				homeTeam: displayText(match.homeTeam?.name),
				awayTeam: displayText(match.awayTeam?.name),
				venue: displayText(match.venue),
				city: displayText(match.city),
				groupLabel: displayText(group.label),
			}))
		)
	}, [detail])

	return (
		<div className="space-y-6">
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
							{ id: 'match', header: 'Match', cell: (row) => <div><p className="font-medium text-foreground">{row.homeTeam} vs {row.awayTeam}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{row.id}</p></div>, headerClassName: 'min-w-72' },
							{ id: 'kickoff', header: 'Kickoff', cell: (row) => new Date(row.startsAt).toLocaleString(), cellClassName: 'text-muted-foreground min-w-44' },
							{ id: 'round', header: 'Round', cell: (row) => <div><p>{row.round}</p><p className="mt-1 text-xs text-muted-foreground">{row.groupLabel}</p></div>, cellClassName: 'min-w-36' },
							{ id: 'venue', header: 'Venue', cell: (row) => <div><p>{row.venue}</p><p className="mt-1 text-xs text-muted-foreground">{row.city}</p></div>, cellClassName: 'min-w-40' },
							{ id: 'status', header: 'Status', cell: (row) => <Badge variant="outline" className="px-1.5 text-muted-foreground">{row.status}</Badge>, cellClassName: 'w-28' },
						]}
						rows={rows}
						getRowId={(row) => row.id}
						getSearchText={(row) => `${row.homeTeam} ${row.awayTeam} ${row.round} ${row.groupLabel} ${row.venue} ${row.city} ${row.status}`}
						searchPlaceholder="Filter matches..."
						emptyMessage="No matches found."
					/>
				</CardContent>
			</Card>
		</div>
	)
}
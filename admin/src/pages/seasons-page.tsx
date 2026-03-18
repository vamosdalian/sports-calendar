import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronDownIcon } from 'lucide-react'

import { AddSeasonDialog } from '@/components/add-season-dialog'
import { CatalogDataTable } from '@/components/catalog-data-table'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { EditSeasonDialog } from '@/components/edit-season-dialog'
import { useAuth } from '@/components/use-auth'
import { useToast } from '@/components/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
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
			<Card className="demo-panel">
				<CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
					<div>
						<CardTitle>Season management</CardTitle>
						<CardDescription>Manage seasons for {leagueSlug}.</CardDescription>
					</div>
					<Button onClick={() => setCreateOpen(true)} type="button">Add season</Button>
				</CardHeader>
				<CardContent>
					{error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
				</CardContent>
			</Card>
			<div className="space-y-6">
				<Card className="demo-panel">
					<CardHeader>
						<CardTitle>Season list</CardTitle>
						<CardDescription>Select a season.</CardDescription>
					</CardHeader>
					<CardContent>
						<CatalogDataTable
							columns={[
								{ id: 'slug', header: 'Slug', cell: (season) => <span className="font-mono text-xs">{season.slug}</span>, headerClassName: 'min-w-40' },
								{ id: 'label', header: 'Label', cell: (season) => season.label },
								{ id: 'years', header: 'Years', cell: (season) => `${season.startYear}-${season.endYear}`, cellClassName: 'text-muted-foreground' },
								{ id: 'duration', header: 'Duration', cell: (season) => `${season.defaultMatchDurationMinutes} min`, cellClassName: 'text-muted-foreground' },
							]}
							rows={seasons}
							getRowId={(season) => season.slug}
							getSearchText={(season) => `${season.slug} ${season.label} ${season.startYear} ${season.endYear}`}
							searchPlaceholder="Filter seasons..."
							emptyMessage="No seasons found."
							onRowClick={(season) => {
								void handleSelectSeason(season.slug)
							}}
							rowClassName={(season) => season.slug === selectedSeason ? 'bg-muted/40' : undefined}
							renderRowActions={(season) => (
								<>
									<DropdownMenuItem onSelect={() => void handleSelectSeason(season.slug)}>
										Inspect fixtures
									</DropdownMenuItem>
									<DropdownMenuItem onSelect={() => setEditingSeason(season)}>Edit</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="text-destructive focus:text-destructive"
										onSelect={() => {
											setDeleteError(null)
											setDeletingSeason(season)
										}}
									>
										Delete
									</DropdownMenuItem>
								</>
							)}
						/>
					</CardContent>
				</Card>
				<Card className="demo-panel">
					<CardHeader>
						<CardTitle>Season fixtures</CardTitle>
						<CardDescription>{detail ? `${detail.seasonLabel} · ${countMatches(detail)} matches` : 'Select a season to inspect its full schedule.'}</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{detail ? (
							<>
								<div className="space-y-3">
									<FixtureMetaDisclosure label="Description" value={displayText(detail.calendarDescription)} />
									<FixtureMetaDisclosure label="Data source" value={displayText(detail.dataSourceNote)} />
									<FixtureMetaDisclosure label="Notes" value={displayText(detail.notes)} />
								</div>
								<div className="space-y-4">
									{detail.groups.map((group) => (
										<div key={group.key} className="rounded-lg border border-border">
											<div className="border-b border-border bg-muted/20 px-4 py-3"><p className="font-semibold text-ink">{displayText(group.label)}</p></div>
											<div className="divide-y divide-border">{group.matches.map((match) => <MatchRow key={match.id} match={match} />)}</div>
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

function FixtureMetaDisclosure({ label, value }: { label: string; value: string }) {
	return (
		<details className="group rounded-lg border border-border bg-muted/20">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
				<div>
					<p className="eyebrow-label">{label}</p>
				</div>
				<ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
			</summary>
			<div className="border-t border-border px-4 py-4 text-sm text-foreground">
				{value}
			</div>
		</details>
	)
}
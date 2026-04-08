import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDownIcon } from 'lucide-react'

import { AddSeasonDialog } from '@/components/add-season-dialog'
import { CatalogDataTable } from '@/components/catalog-data-table'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { EditSeasonDialog } from '@/components/edit-season-dialog'
import { useAuth } from '@/components/use-auth'
import { useToast } from '@/components/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import type { AdminSeasonItem, SeasonDetailResponse } from '@/types'

function displayText(value: string | Record<string, string> | undefined) {
	if (!value) {
		return '-'
	}
	if (typeof value === 'string') {
		return value
	}
	return value.zh || value.en || Object.values(value)[0] || '-'
}

export function SeasonsPage() {
	const { sportSlug = '', leagueSlug = '' } = useParams()
	const navigate = useNavigate()
	const { token } = useAuth()
	const { showToast } = useToast()
	const [seasons, setSeasons] = useState<AdminSeasonItem[]>([])
	const [leagueMetadata, setLeagueMetadata] = useState<SeasonDetailResponse | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [createOpen, setCreateOpen] = useState(false)
	const [editingSeason, setEditingSeason] = useState<AdminSeasonItem | null>(null)
	const [deletingSeason, setDeletingSeason] = useState<AdminSeasonItem | null>(null)
	const [refreshingSeasonSlug, setRefreshingSeasonSlug] = useState<string | null>(null)
	const [deletePending, setDeletePending] = useState(false)
	const [deleteError, setDeleteError] = useState<string | null>(null)

	const loadSeasons = useCallback(async () => {
		if (!token) {
			return
		}
		const response = await api.listAdminSeasons(token, sportSlug, leagueSlug)
		setSeasons(response.items)
		const firstSeasonSlug = response.items[0]?.slug
		if (firstSeasonSlug) {
			setLeagueMetadata(await api.getSeasonDetail(sportSlug, leagueSlug, firstSeasonSlug))
		} else {
			setLeagueMetadata(null)
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

	function openMatches(seasonSlug: string) {
		void navigate(`/sports/${sportSlug}/leagues/${leagueSlug}/seasons/${seasonSlug}/matches`)
	}

	async function handleRefreshSeason(season: AdminSeasonItem) {
		if (!token) {
			return
		}
		setRefreshingSeasonSlug(season.slug)
		try {
			await api.refreshSeasonSchedule(token, sportSlug, leagueSlug, season.slug)
			await loadSeasons()
			showToast({ title: 'Season refreshed', description: `${season.slug} fixtures were fetched immediately.`, tone: 'success' })
		} catch (caught) {
			showToast({ title: 'Refresh failed', description: caught instanceof Error ? caught.message : 'refresh failed', tone: 'error' })
		} finally {
			setRefreshingSeasonSlug(null)
		}
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
						<CardDescription>Open a season to view matches.</CardDescription>
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
								openMatches(season.slug)
							}}
							renderRowActions={(season) => (
								<>
									<DropdownMenuItem onSelect={() => openMatches(season.slug)}>
										Open matches
									</DropdownMenuItem>
									<DropdownMenuItem
										disabled={refreshingSeasonSlug === season.slug}
										onSelect={() => {
											void handleRefreshSeason(season)
										}}
									>
										{refreshingSeasonSlug === season.slug ? 'Refreshing...' : 'Refresh now'}
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
				{leagueMetadata ? (
					<Card className="demo-panel">
						<CardHeader>
							<CardTitle>League metadata</CardTitle>
							<CardDescription>Reference notes for this league.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<FixtureMetaDisclosure label="Description" value={displayText(leagueMetadata.calendarDescription)} />
							<FixtureMetaDisclosure label="Data source" value={displayText(leagueMetadata.dataSourceNote)} />
							<FixtureMetaDisclosure label="Notes" value={displayText(leagueMetadata.notes)} />
						</CardContent>
					</Card>
				) : null}
			</div>
			<AddSeasonDialog
				sportSlug={sportSlug}
				leagueSlug={leagueSlug}
				open={createOpen}
				onOpenChange={setCreateOpen}
				onCreated={async (seasonSlug) => {
					await loadSeasons()
					showToast({ title: 'Season created', description: `${seasonSlug} is ready for fixture inspection.`, tone: 'success' })
				}}
			/>
			<EditSeasonDialog season={editingSeason} open={editingSeason !== null} onOpenChange={(open) => { if (!open) { setEditingSeason(null) } }} onSaved={async () => { await loadSeasons(); showToast({ title: 'Season updated', description: 'Season metadata was saved.', tone: 'success' }) }} />
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

function FixtureMetaDisclosure({ label, value }: { label: string; value: string }) {
	return (
		<details className="group rounded-lg border border-border bg-muted/20">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
				<p className="eyebrow-label">{label}</p>
				<ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
			</summary>
			<div className="border-t border-border px-4 py-4 text-sm text-foreground">
				{value}
			</div>
		</details>
	)
}
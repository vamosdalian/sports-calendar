import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AddLeagueDialog } from '@/components/add-league-dialog'
import { CatalogDataTable } from '@/components/catalog-data-table'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { EditLeagueDialog } from '@/components/edit-league-dialog'
import { useAuth } from '@/components/use-auth'
import { useToast } from '@/components/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { pickLocalizedPreview } from '@/lib/localized-fields'
import type { LeagueItem } from '@/types'

export function LeaguesPage() {
	const { sportSlug = '' } = useParams()
	const { token } = useAuth()
	const { showToast } = useToast()
	const [leagues, setLeagues] = useState<LeagueItem[]>([])
	const [error, setError] = useState<string | null>(null)
	const [createOpen, setCreateOpen] = useState(false)
	const [editingLeague, setEditingLeague] = useState<LeagueItem | null>(null)
	const [deletingLeague, setDeletingLeague] = useState<LeagueItem | null>(null)
	const [deletePending, setDeletePending] = useState(false)
	const [deleteError, setDeleteError] = useState<string | null>(null)

	const loadLeagues = useCallback(async () => {
		if (!token) {
			return
		}
		const leaguesResponse = await api.listLeagues(token, sportSlug)
		setLeagues(leaguesResponse.items)
	}, [sportSlug, token])

	async function handleDeleteLeague() {
		if (!token || !deletingLeague) {
			return
		}
		setDeletePending(true)
		setDeleteError(null)
		try {
			await api.deleteLeague(token, sportSlug, deletingLeague.slug)
			await loadLeagues()
			setDeletingLeague(null)
			showToast({ title: 'League deleted', description: `${deletingLeague.slug} and its seasons were removed from the local catalog.`, tone: 'success' })
		} catch (caught) {
			setDeleteError(caught instanceof Error ? caught.message : 'delete failed')
		} finally {
			setDeletePending(false)
		}
	}

	useEffect(() => {
		if (!sportSlug) {
			return
		}
		let active = true
		async function hydrate() {
			try {
				await loadLeagues()
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
	}, [loadLeagues, sportSlug])

	return (
		<div className="space-y-6">
			<Card className="demo-panel">
				<CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
					<div>
						<CardTitle>League catalog</CardTitle>
						<CardDescription>Manage leagues for {sportSlug}.</CardDescription>
					</div>
					<Button onClick={() => setCreateOpen(true)} type="button">Add league</Button>
				</CardHeader>
				<CardContent>
					{error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
					<CatalogDataTable
						columns={[
							{ id: 'id', header: 'ID', cell: (league) => league.id.toString(), cellClassName: 'w-20' },
							{ id: 'slug', header: 'Slug', cell: (league) => <span className="font-mono text-xs">{league.slug}</span> },
							{ id: 'name', header: 'Name', cell: (league) => pickLocalizedPreview(league.name) },
							{ id: 'syncInterval', header: 'Sync', cell: (league) => league.syncInterval, cellClassName: 'text-muted-foreground' },
						]}
						rows={leagues}
						getRowId={(league) => league.slug}
						getSearchText={(league) => `${league.slug} ${pickLocalizedPreview(league.name)} ${league.syncInterval}`}
						searchPlaceholder="Filter leagues..."
						emptyMessage="No leagues found."
						renderRowActions={(league) => (
							<>
								<DropdownMenuItem asChild>
									<Link to={`/sports/${sportSlug}/leagues/${league.slug}/seasons`}>Open seasons</Link>
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setEditingLeague(league)}>Edit</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive focus:text-destructive"
									onSelect={() => {
										setDeleteError(null)
										setDeletingLeague(league)
									}}
								>
									Delete
								</DropdownMenuItem>
							</>
						)}
					/>
				</CardContent>
			</Card>
			<AddLeagueDialog sportSlug={sportSlug} open={createOpen} onOpenChange={setCreateOpen} onCreated={async () => { await loadLeagues(); showToast({ title: 'League created', description: 'The league is ready for season setup.', tone: 'success' }) }} />
			<EditLeagueDialog league={editingLeague} open={editingLeague !== null} onOpenChange={(open) => { if (!open) { setEditingLeague(null) } }} onSaved={async () => { await loadLeagues(); showToast({ title: 'League updated', description: 'Local league settings were saved.', tone: 'success' }) }} />
			<ConfirmActionDialog
				open={deletingLeague !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeletingLeague(null)
						setDeleteError(null)
					}
				}}
				title="Delete league"
				description={deletingLeague ? `Delete ${deletingLeague.slug} and every season, team, and match under it?` : 'Delete this league?'}
				confirmLabel="Delete league"
				pendingLabel="Deleting..."
				onConfirm={handleDeleteLeague}
				pending={deletePending}
				error={deleteError}
			/>
		</div>
	)
}
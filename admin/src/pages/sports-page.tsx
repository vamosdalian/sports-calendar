import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AddSportDialog } from '@/components/add-sport-dialog'
import { CatalogDataTable } from '@/components/catalog-data-table'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { EditSportDialog } from '@/components/edit-sport-dialog'
import { useAuth } from '@/components/use-auth'
import { useToast } from '@/components/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { pickLocalizedPreview } from '@/lib/localized-fields'
import type { SportItem } from '@/types'

export function SportsPage() {
	const navigate = useNavigate()
	const { token } = useAuth()
	const { showToast } = useToast()
	const [sports, setSports] = useState<SportItem[]>([])
	const [error, setError] = useState<string | null>(null)
	const [createOpen, setCreateOpen] = useState(false)
	const [editingSport, setEditingSport] = useState<SportItem | null>(null)
	const [deletingSport, setDeletingSport] = useState<SportItem | null>(null)
	const [deletePending, setDeletePending] = useState(false)
	const [deleteError, setDeleteError] = useState<string | null>(null)

	const loadSports = useCallback(async () => {
		if (!token) {
			return
		}
		const response = await api.listSports(token)
		setSports(response.items)
	}, [token])

	async function handleDeleteSport() {
		if (!token || !deletingSport) {
			return
		}
		setDeletePending(true)
		setDeleteError(null)
		try {
			await api.deleteSport(token, deletingSport.slug)
			await loadSports()
			setDeletingSport(null)
			showToast({ title: 'Sport deleted', description: `${deletingSport.slug} and its nested leagues and seasons were removed.`, tone: 'success' })
		} catch (caught) {
			setDeleteError(caught instanceof Error ? caught.message : 'delete failed')
		} finally {
			setDeletePending(false)
		}
	}

	useEffect(() => {
		let active = true
		async function hydrate() {
			try {
				await loadSports()
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
	}, [loadSports])

	return (
		<div className="space-y-6">
			<Card className="demo-panel">
				<CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
					<div>
						<CardTitle>Sport catalog</CardTitle>
						<CardDescription>Manage sports.</CardDescription>
					</div>
					<Button onClick={() => setCreateOpen(true)} type="button">Add sport</Button>
				</CardHeader>
				<CardContent>
					{error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
					<CatalogDataTable
						columns={[
							{ id: 'id', header: 'ID', cell: (sport) => sport.id.toString(), cellClassName: 'w-20' },
							{ id: 'slug', header: 'Slug', cell: (sport) => <span className="font-mono text-xs">{sport.slug}</span> },
							{ id: 'name', header: 'Name', cell: (sport) => pickLocalizedPreview(sport.name) },
							{ id: 'updatedAt', header: 'Updated', cell: (sport) => new Date(sport.updatedAt).toLocaleString(), headerClassName: 'min-w-44', cellClassName: 'text-muted-foreground' },
						]}
						rows={sports}
						getRowId={(sport) => sport.slug}
						getSearchText={(sport) => `${sport.slug} ${pickLocalizedPreview(sport.name)}`}
						searchPlaceholder="Filter sports..."
						emptyMessage="No sports found."
						onRowClick={(sport) => {
							void navigate(`/sports/${sport.slug}/leagues`)
						}}
						renderRowActions={(sport) => (
							<>
								<DropdownMenuItem asChild>
									<Link to={`/sports/${sport.slug}/leagues`}>Open leagues</Link>
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setEditingSport(sport)}>Edit</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive focus:text-destructive"
									onSelect={() => {
										setDeleteError(null)
										setDeletingSport(sport)
									}}
								>
									Delete
								</DropdownMenuItem>
							</>
						)}
					/>
				</CardContent>
			</Card>
			<AddSportDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={async () => { await loadSports(); showToast({ title: 'Sport created', description: 'The new sport is now available for league setup.', tone: 'success' }) }} />
			<EditSportDialog sport={editingSport} open={editingSport !== null} onOpenChange={(open) => { if (!open) { setEditingSport(null) } }} onSaved={async () => { await loadSports(); showToast({ title: 'Sport updated', description: 'Local sport metadata was saved.', tone: 'success' }) }} />
			<ConfirmActionDialog
				open={deletingSport !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeletingSport(null)
						setDeleteError(null)
					}
				}}
				title="Delete sport"
				description={deletingSport ? `Delete ${deletingSport.slug} and every league, season, team, and match under it?` : 'Delete this sport?'}
				confirmLabel="Delete sport"
				pendingLabel="Deleting..."
				onConfirm={handleDeleteSport}
				pending={deletePending}
				error={deleteError}
			/>
		</div>
	)
}

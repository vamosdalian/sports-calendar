import { useCallback, useEffect, useState } from 'react'

import { CatalogDataTable } from '@/components/catalog-data-table'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { EditVenueDialog } from '@/components/edit-venue-dialog'
import { useAuth } from '@/components/use-auth'
import { useToast } from '@/components/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { pickLocalizedPreview } from '@/lib/localized-fields'
import type { AdminVenueItem } from '@/types'

export function VenuesPage() {
	const { token } = useAuth()
	const { showToast } = useToast()
	const [venues, setVenues] = useState<AdminVenueItem[]>([])
	const [error, setError] = useState<string | null>(null)
	const [editingVenue, setEditingVenue] = useState<AdminVenueItem | null>(null)
	const [creatingVenue, setCreatingVenue] = useState(false)
	const [deletingVenue, setDeletingVenue] = useState<AdminVenueItem | null>(null)
	const [deletePending, setDeletePending] = useState(false)
	const [deleteError, setDeleteError] = useState<string | null>(null)

	const loadVenues = useCallback(async () => {
		if (!token) {
			return
		}
		const response = await api.listAdminVenues(token)
		setVenues(response.items)
	}, [token])

	useEffect(() => {
		if (!token) {
			return
		}
		let active = true
		async function hydrate() {
			try {
				await loadVenues()
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
	}, [loadVenues, token])

	async function handleDeleteVenue() {
		if (!token || !deletingVenue) {
			return
		}
		setDeletePending(true)
		setDeleteError(null)
		try {
			await api.deleteVenue(token, deletingVenue.id)
			await loadVenues()
			showToast({ title: 'Venue deleted', description: 'The venue was removed from the admin catalog.', tone: 'success' })
			setDeletingVenue(null)
		} catch (caught) {
			setDeleteError(caught instanceof Error ? caught.message : 'delete failed')
		} finally {
			setDeletePending(false)
		}
	}

	return (
		<div className="space-y-6">
			<EditVenueDialog
				venue={creatingVenue ? null : editingVenue}
				open={creatingVenue || editingVenue !== null}
				onOpenChange={(open) => {
					if (!open) {
						setCreatingVenue(false)
						setEditingVenue(null)
					}
				}}
				onSaved={async () => {
					await loadVenues()
					showToast({ title: creatingVenue ? 'Venue created' : 'Venue updated', description: 'Venue localization changes were saved.', tone: 'success' })
					setCreatingVenue(false)
					setEditingVenue(null)
				}}
			/>
			<Card className="demo-panel">
				<CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
					<div>
						<CardTitle>Venues</CardTitle>
						<CardDescription>Manage venue names and localized city/country labels used across matches.</CardDescription>
					</div>
					<Button onClick={() => setCreatingVenue(true)} type="button">Add venue</Button>
				</CardHeader>
				<CardContent>
					{error ? <p className="text-sm text-danger">{error}</p> : null}
				</CardContent>
			</Card>
			<Card className="demo-panel">
				<CardHeader>
					<CardTitle>Venue catalog</CardTitle>
					<CardDescription>Review and edit venue metadata synced from TheSportsDB or created manually.</CardDescription>
				</CardHeader>
				<CardContent>
					<CatalogDataTable
						columns={[
							{ id: 'id', header: 'ID', cell: (venue) => venue.id.toString(), cellClassName: 'w-24' },
							{ id: 'name', header: 'Name', cell: (venue) => pickLocalizedPreview(venue.name), cellClassName: 'min-w-56' },
							{ id: 'city', header: 'City', cell: (venue) => pickLocalizedPreview(venue.city), cellClassName: 'min-w-40' },
							{ id: 'country', header: 'Country', cell: (venue) => pickLocalizedPreview(venue.country), cellClassName: 'min-w-40' },
							{ id: 'updated', header: 'Updated', cell: (venue) => new Date(venue.updatedAt).toLocaleString(), cellClassName: 'min-w-44 text-muted-foreground' },
						]}
						rows={venues}
						getRowId={(venue) => String(venue.id)}
						getSearchText={(venue) => `${venue.id} ${Object.values(venue.name).join(' ')} ${Object.values(venue.city).join(' ')} ${Object.values(venue.country).join(' ')}`}
						searchPlaceholder="Filter venues..."
						emptyMessage="No venues found."
						renderRowActions={(venue) => (
							<>
								<DropdownMenuItem onSelect={() => setEditingVenue(venue)}>Edit</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => {
									setDeleteError(null)
									setDeletingVenue(venue)
								}}>
									Delete
								</DropdownMenuItem>
							</>
						)}
					/>
				</CardContent>
			</Card>
			<ConfirmActionDialog
				open={deletingVenue !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeletingVenue(null)
						setDeleteError(null)
					}
				}}
				title="Delete venue"
				description={deletingVenue ? `Delete venue ${deletingVenue.id}? This is blocked if any match still references it.` : 'Delete this venue?'}
				confirmLabel="Delete venue"
				pendingLabel="Deleting..."
				onConfirm={handleDeleteVenue}
				pending={deletePending}
				error={deleteError}
			/>
		</div>
	)
}

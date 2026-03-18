import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { AddSportDialog } from '@/components/add-sport-dialog'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { EditSportDialog } from '@/components/edit-sport-dialog'
import { useAuth } from '@/components/use-auth'
import { useToast } from '@/components/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { pickLocalizedPreview } from '@/lib/localized-fields'
import type { SportItem } from '@/types'

export function SportsPage() {
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
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line/70 bg-white px-5 py-4">
				<div>
					<p className="text-xs uppercase tracking-[0.16em] text-muted">Catalog path</p>
					<h1 className="mt-2 text-2xl font-semibold text-ink">Sports</h1>
					<p className="mt-1 text-sm text-muted">Start here, then open one sport to manage its leagues and seasons.</p>
				</div>
				<Badge>Step 1 of 3</Badge>
			</div>
			<Card>
				<CardHeader>
					<Badge>Sports</Badge>
					<CardTitle className="mt-4">Create sport</CardTitle>
					<CardDescription>Fetch a sport from TheSportsDB, review the suggested fields in a dialog, then save it to the local catalog.</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/70 bg-shell/55 px-4 py-4">
						<p className="text-sm text-muted">The creation form now opens in a dialog so the page stays focused on the catalog table.</p>
						<Button onClick={() => setCreateOpen(true)} type="button">Add sport</Button>
					</div>
					{error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Sport catalog</CardTitle>
					<CardDescription>Select a sport to continue with league management.</CardDescription>
				</CardHeader>
				<CardContent className="overflow-x-auto">
					<Table>
						<TableHead><TableRow><TableHeaderCell>ID</TableHeaderCell><TableHeaderCell>Slug</TableHeaderCell><TableHeaderCell>Name</TableHeaderCell><TableHeaderCell>Updated</TableHeaderCell><TableHeaderCell>Action</TableHeaderCell></TableRow></TableHead>
						<TableBody>
							{sports.map((sport) => (
								<TableRow key={sport.slug}>
									<TableCell>{sport.id}</TableCell>
									<TableCell className="font-mono text-xs">{sport.slug}</TableCell>
									<TableCell>{pickLocalizedPreview(sport.name)}</TableCell>
									<TableCell>{new Date(sport.updatedAt).toLocaleString()}</TableCell>
									<TableCell className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditingSport(sport)} type="button">Edit</Button><Button size="sm" variant="danger" onClick={() => { setDeleteError(null); setDeletingSport(sport) }} type="button">Delete</Button><Button asChild size="sm" variant="outline"><Link to={`/sports/${sport.slug}/leagues`}>Open leagues</Link></Button></TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
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
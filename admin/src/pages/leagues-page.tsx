import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AddLeagueDialog } from '@/components/add-league-dialog'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { EditLeagueDialog } from '@/components/edit-league-dialog'
import { useAuth } from '@/components/use-auth'
import { useToast } from '@/components/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table'
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
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line/70 bg-white px-5 py-4">
				<div>
					<p className="text-xs uppercase tracking-[0.16em] text-muted">Catalog path</p>
					<h1 className="mt-2 text-2xl font-semibold text-ink">Sports / {sportSlug} / Leagues</h1>
					<p className="mt-1 text-sm text-muted">Pick a league to continue into season management for this sport.</p>
				</div>
				<div className="flex items-center gap-3">
					<Badge>Step 2 of 3</Badge>
					<Button asChild size="sm" variant="outline"><Link to="/sports">Back to sports</Link></Button>
				</div>
			</div>
			<Card>
				<CardHeader>
					<Badge>{sportSlug}</Badge>
					<CardTitle className="mt-4">Create league</CardTitle>
					<CardDescription>Choose a matching TheSportsDB league, let the lookup prefill the fields, and save the local league from a dialog.</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/70 bg-shell/55 px-4 py-4">
						<p className="text-sm text-muted">The dialog keeps the page focused on the league table while still letting you adjust every field before save.</p>
						<Button onClick={() => setCreateOpen(true)} type="button">Add league</Button>
					</div>
					{error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>League catalog</CardTitle>
					<CardDescription>{sportSlug}</CardDescription>
				</CardHeader>
				<CardContent className="overflow-x-auto">
					<Table>
						<TableHead><TableRow><TableHeaderCell>ID</TableHeaderCell><TableHeaderCell>Slug</TableHeaderCell><TableHeaderCell>Name</TableHeaderCell><TableHeaderCell>Sync</TableHeaderCell><TableHeaderCell>Action</TableHeaderCell></TableRow></TableHead>
						<TableBody>
							{leagues.map((league) => (
								<TableRow key={league.slug}>
									<TableCell>{league.id}</TableCell>
									<TableCell className="font-mono text-xs">{league.slug}</TableCell>
									<TableCell>{pickLocalizedPreview(league.name)}</TableCell>
									<TableCell>{league.syncInterval}</TableCell>
									<TableCell className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditingLeague(league)} type="button">Edit</Button><Button size="sm" variant="danger" onClick={() => { setDeleteError(null); setDeletingLeague(league) }} type="button">Delete</Button><Button asChild size="sm" variant="outline"><Link to={`/sports/${sportSlug}/leagues/${league.slug}/seasons`}>Open seasons</Link></Button></TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
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
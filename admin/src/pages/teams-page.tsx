import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { CatalogDataTable } from '@/components/catalog-data-table'
import { EditTeamDialog } from '@/components/edit-team-dialog'
import { useAuth } from '@/components/use-auth'
import { useToast } from '@/components/use-toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { pickLocalizedPreview } from '@/lib/localized-fields'
import type { AdminTeamItem } from '@/types'

export function TeamsPage() {
	const { sportSlug = '', leagueSlug = '' } = useParams()
	const { token } = useAuth()
	const { showToast } = useToast()
	const [teams, setTeams] = useState<AdminTeamItem[]>([])
	const [error, setError] = useState<string | null>(null)
	const [editingTeam, setEditingTeam] = useState<AdminTeamItem | null>(null)

	const loadTeams = useCallback(async () => {
		if (!token) {
			return
		}
		const response = await api.listAdminTeams(token, sportSlug, leagueSlug)
		setTeams(response.items)
	}, [leagueSlug, sportSlug, token])

	useEffect(() => {
		if (!sportSlug || !leagueSlug) {
			return
		}
		let active = true
		async function hydrate() {
			try {
				await loadTeams()
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
	}, [leagueSlug, loadTeams, sportSlug])

	return (
		<div className="space-y-6">
			<EditTeamDialog
				team={editingTeam}
				sportSlug={sportSlug}
				leagueSlug={leagueSlug}
				open={editingTeam !== null}
				onOpenChange={(open) => {
					if (!open) {
						setEditingTeam(null)
					}
				}}
				onSaved={async () => {
					await loadTeams()
					showToast({ title: 'Team updated', description: 'Localized team name changes were saved.', tone: 'success' })
					setEditingTeam(null)
				}}
			/>
			<Card className="demo-panel">
				<CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
					<div>
						<CardTitle>Teams</CardTitle>
						<CardDescription>Manage localized team names for {leagueSlug}.</CardDescription>
					</div>
					<Button asChild type="button" variant="outline">
						<Link to={`/sports/${sportSlug}/leagues`}>Back to leagues</Link>
					</Button>
				</CardHeader>
				<CardContent className="space-y-4">
					{error ? <p className="text-sm text-danger">{error}</p> : null}
					<Alert>
						<AlertTitle>Sync note</AlertTitle>
						<AlertDescription>
							Provider-backed leagues may overwrite provider locales on the next sync. Additional locales you add here are usually preserved.
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
			<Card className="demo-panel">
				<CardHeader>
					<CardTitle>Team catalog</CardTitle>
					<CardDescription>Review and edit the localized display name for each team in this league.</CardDescription>
				</CardHeader>
				<CardContent>
					<CatalogDataTable
						columns={[
							{ id: 'id', header: 'ID', cell: (team) => team.id.toString(), cellClassName: 'w-24' },
							{ id: 'slug', header: 'Slug', cell: (team) => <span className="font-mono text-xs">{team.slug}</span>, cellClassName: 'min-w-56' },
							{ id: 'name', header: 'Name', cell: (team) => pickLocalizedPreview(team.name), cellClassName: 'min-w-52' },
						]}
						rows={teams}
						getRowId={(team) => String(team.id)}
						getSearchText={(team) => `${team.id} ${team.slug} ${Object.values(team.name).join(' ')}`}
						searchPlaceholder="Filter teams..."
						emptyMessage="No teams found."
						renderRowActions={(team) => <DropdownMenuItem onSelect={() => setEditingTeam(team)}>Edit</DropdownMenuItem>}
					/>
				</CardContent>
			</Card>
		</div>
	)
}
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '@/components/auth-provider'
import { LocalizedFieldsEditor } from '@/components/localized-fields-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { entriesToLocalizedText, pickLocalizedPreview, type LocalizedFieldEntry } from '@/lib/localized-fields'
import type { LeagueItem } from '@/types'

export function LeaguesPage() {
	const { sportSlug = '' } = useParams()
	const { token } = useAuth()
	const [leagues, setLeagues] = useState<LeagueItem[]>([])
	const [error, setError] = useState<string | null>(null)
	const [pending, setPending] = useState(false)
	const [form, setForm] = useState({
		id: '',
		slug: '',
		syncInterval: '@daily',
		nameEntries: [{ locale: 'en', value: '' }] as LocalizedFieldEntry[],
		calendarDescriptionEntries: [] as LocalizedFieldEntry[],
		dataSourceNoteEntries: [] as LocalizedFieldEntry[],
		notesEntries: [] as LocalizedFieldEntry[],
	})

	async function loadLeagues() {
		if (!token) {
			return
		}
		const leaguesResponse = await api.listLeagues(token, sportSlug)
		setLeagues(leaguesResponse.items)
	}

	useEffect(() => {
		if (!sportSlug) {
			return
		}
		void loadLeagues().catch((caught) => setError(caught instanceof Error ? caught.message : 'load failed'))
	}, [sportSlug, token])

	async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!token) {
			return
		}
		setPending(true)
		setError(null)
		try {
			await api.createLeague(token, {
				id: Number(form.id),
				sportSlug,
				slug: form.slug,
				name: entriesToLocalizedText(form.nameEntries),
				syncInterval: form.syncInterval,
				calendarDescription: entriesToLocalizedText(form.calendarDescriptionEntries),
				dataSourceNote: entriesToLocalizedText(form.dataSourceNoteEntries),
				notes: entriesToLocalizedText(form.notesEntries),
			})
			setForm({
				id: '',
				slug: '',
				syncInterval: '@daily',
				nameEntries: [{ locale: 'en', value: '' }],
				calendarDescriptionEntries: [],
				dataSourceNoteEntries: [],
				notesEntries: [],
			})
			await loadLeagues()
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'create failed')
		} finally {
			setPending(false)
		}
	}

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
					<CardDescription>League id must match the TheSportsDB league id consumed by backend sync. Multi-language fields are submitted as locale maps.</CardDescription>
				</CardHeader>
				<CardContent>
					<form className="space-y-4" onSubmit={handleCreate}>
						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						<div><Label htmlFor="league-id">TheSportsDB id</Label><Input id="league-id" value={form.id} onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))} /></div>
						<div><Label htmlFor="league-slug">Slug</Label><Input id="league-slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} /></div>
						<div><Label htmlFor="league-sync">Sync interval</Label><Input id="league-sync" value={form.syncInterval} onChange={(event) => setForm((current) => ({ ...current, syncInterval: event.target.value }))} /></div>
						</div>
						<LocalizedFieldsEditor
							idPrefix="league-name"
							label="Localized name"
							description="Add any locales you need. The backend requires at least one `en` entry."
							entries={form.nameEntries}
							onChange={(nameEntries) => setForm((current) => ({ ...current, nameEntries }))}
							required
						/>
						<LocalizedFieldsEditor
							idPrefix="league-calendar-description"
							label="Calendar description"
							description="Optional localized description for exported calendar metadata."
							entries={form.calendarDescriptionEntries}
							onChange={(calendarDescriptionEntries) => setForm((current) => ({ ...current, calendarDescriptionEntries }))}
						/>
						<LocalizedFieldsEditor
							idPrefix="league-data-source-note"
							label="Data source note"
							description="Optional localized note that explains the data origin."
							entries={form.dataSourceNoteEntries}
							onChange={(dataSourceNoteEntries) => setForm((current) => ({ ...current, dataSourceNoteEntries }))}
						/>
						<LocalizedFieldsEditor
							idPrefix="league-notes"
							label="Notes"
							description="Optional internal notes shown in season detail views."
							entries={form.notesEntries}
							onChange={(notesEntries) => setForm((current) => ({ ...current, notesEntries }))}
						/>
						<div><Button disabled={pending} type="submit">{pending ? 'Creating...' : 'Create league'}</Button></div>
					</form>
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
									<TableCell><Button asChild size="sm" variant="outline"><Link to={`/sports/${sportSlug}/leagues/${league.slug}/seasons`}>Open seasons</Link></Button></TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	)
}
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

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
import type { SportItem } from '@/types'

export function SportsPage() {
	const { token } = useAuth()
	const [sports, setSports] = useState<SportItem[]>([])
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [form, setForm] = useState({ id: '102', slug: '', nameEntries: [{ locale: 'en', value: '' }] as LocalizedFieldEntry[] })

	async function loadSports() {
		if (!token) {
			return
		}
		const response = await api.listSports(token)
		setSports(response.items)
	}

	useEffect(() => {
		void loadSports().catch((caught) => setError(caught instanceof Error ? caught.message : 'load failed'))
	}, [token])

	async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!token) {
			return
		}
		setPending(true)
		setError(null)
		try {
			await api.createSport(token, {
				id: Number(form.id),
				slug: form.slug,
				name: entriesToLocalizedText(form.nameEntries),
			})
			setForm({ id: String(Number(form.id) + 1), slug: '', nameEntries: [{ locale: 'en', value: '' }] })
			await loadSports()
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
					<h1 className="mt-2 text-2xl font-semibold text-ink">Sports</h1>
					<p className="mt-1 text-sm text-muted">Start here, then open one sport to manage its leagues and seasons.</p>
				</div>
				<Badge>Step 1 of 3</Badge>
			</div>
			<Card>
				<CardHeader>
					<Badge>Sports</Badge>
					<CardTitle className="mt-4">Create sport</CardTitle>
					<CardDescription>Sports are the top-level containers for league and season management. Name is stored as a locale map and must include `en`.</CardDescription>
				</CardHeader>
				<CardContent>
					<form className="space-y-4" onSubmit={handleCreate}>
						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						<div><Label htmlFor="sport-id">Sport id</Label><Input id="sport-id" value={form.id} onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))} /></div>
						<div><Label htmlFor="sport-slug">Slug</Label><Input id="sport-slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} /></div>
						</div>
						<LocalizedFieldsEditor
							idPrefix="sport-name"
							label="Localized name"
							description="Add any locales you need. The backend requires at least one `en` entry."
							entries={form.nameEntries}
							onChange={(nameEntries) => setForm((current) => ({ ...current, nameEntries }))}
							required
						/>
						<div><Button disabled={pending} type="submit">{pending ? 'Creating...' : 'Create sport'}</Button></div>
					</form>
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
									<TableCell><Button asChild size="sm" variant="outline"><Link to={`/sports/${sport.slug}/leagues`}>Open leagues</Link></Button></TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	)
}
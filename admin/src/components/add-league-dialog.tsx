import { useEffect, useState } from 'react'

import { useAdminLocales } from '@/components/admin-locales-provider'
import { useAuth } from '@/components/use-auth'
import { LocalizedFieldsEditor } from '@/components/localized-fields-editor'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { createEmptyLocalizedEntry, entriesToLocalizedText, type LocalizedFieldEntry } from '@/lib/localized-fields'

type AddLeagueDialogProps = {
	sportSlug: string
	open: boolean
	onOpenChange: (open: boolean) => void
	onCreated: () => Promise<void>
}

type LeagueFormState = {
	id: string
	slug: string
	show: boolean
	provider: string
	externalRef: string
	syncInterval: string
	nameEntries: LocalizedFieldEntry[]
	calendarDescriptionEntries: LocalizedFieldEntry[]
	dataSourceNoteEntries: LocalizedFieldEntry[]
	notesEntries: LocalizedFieldEntry[]
}

const emptyLeagueForm: LeagueFormState = {
	id: '',
	slug: '',
	show: false,
	provider: 'spider',
	externalRef: '',
	syncInterval: '@daily',
	nameEntries: [{ locale: 'en', value: '' }],
	calendarDescriptionEntries: [],
	dataSourceNoteEntries: [],
	notesEntries: [],
}

export function AddLeagueDialog({ sportSlug, open, onOpenChange, onCreated }: AddLeagueDialogProps) {
	const { token } = useAuth()
	const { locales, loading: localesLoading, error: localesError } = useAdminLocales()
	const [form, setForm] = useState<LeagueFormState>(emptyLeagueForm)
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!open) {
			return
		}
		setError(null)
		setForm({ ...emptyLeagueForm, nameEntries: [createEmptyLocalizedEntry(locales)] })
	}, [locales, open])

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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
				show: form.show,
				provider: form.provider,
				externalRef: form.externalRef,
				syncInterval: form.syncInterval,
				calendarDescription: entriesToLocalizedText(form.calendarDescriptionEntries),
				dataSourceNote: entriesToLocalizedText(form.dataSourceNoteEntries),
				notes: entriesToLocalizedText(form.notesEntries),
			})
			await onCreated()
			onOpenChange(false)
			setForm({ ...emptyLeagueForm, nameEntries: [createEmptyLocalizedEntry(locales)] })
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'create failed')
		} finally {
			setPending(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange} title="Create league" description="Enter the league id, slug, sync source, and localized fields, then save it into the local catalog.">
			<form className="space-y-5" onSubmit={handleSubmit}>
				<div className="grid gap-4 md:grid-cols-3">
					<div><Label htmlFor="league-id-dialog">League id</Label><Input id="league-id-dialog" required value={form.id} onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))} /></div>
					<div><Label htmlFor="league-slug-dialog">Slug</Label><Input id="league-slug-dialog" required value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} /></div>
					<div><Label htmlFor="league-sync-dialog">Sync interval</Label><Input id="league-sync-dialog" required value={form.syncInterval} onChange={(event) => setForm((current) => ({ ...current, syncInterval: event.target.value }))} /></div>
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<Label htmlFor="league-provider-dialog">Data source</Label>
						<Select value={form.provider} onValueChange={(provider) => setForm((current) => ({ ...current, provider }))}>
							<SelectTrigger id="league-provider-dialog">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectItem value="spider">spider (Transfermarkt crawler)</SelectItem>
									<SelectItem value="thesportsdb">thesportsdb (retired, not synced)</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>
					</div>
					<div>
						<Label htmlFor="league-external-ref-dialog">External ref</Label>
						<Input id="league-external-ref-dialog" value={form.externalRef} required={form.provider === 'spider'} onChange={(event) => setForm((current) => ({ ...current, externalRef: event.target.value }))} />
						<p className="mt-1 text-sm text-muted">Transfermarkt competition code, e.g. <code>CSL</code>. Single-calendar-year leagues file year N under saison N-1, so use an offset like <code>CSL@-1</code>. Required for spider.</p>
					</div>
				</div>
				<div className="flex items-start gap-3 rounded-2xl border border-line/70 bg-shell/55 px-4 py-3">
					<Checkbox id="league-show-dialog" checked={form.show} onCheckedChange={(checked) => setForm((current) => ({ ...current, show: checked === true }))} />
					<div className="space-y-1">
						<Label htmlFor="league-show-dialog">Show on public site</Label>
						<p className="text-sm text-muted">Keep this off while the league is only for backend setup. Turn it on when users should see it.</p>
					</div>
				</div>
				<LocalizedFieldsEditor
					idPrefix="dialog-league-name"
					label="Localized name"
					description="Add or edit locales before saving."
					entries={form.nameEntries}
					localeOptions={locales}
					onChange={(nameEntries) => setForm((current) => ({ ...current, nameEntries }))}
					loading={localesLoading}
					error={localesError}
					required
				/>
				<LocalizedFieldsEditor
					idPrefix="dialog-league-calendar-description"
					label="Calendar description"
					description="Optional description shown on the public season detail view."
					entries={form.calendarDescriptionEntries}
					localeOptions={locales}
					onChange={(calendarDescriptionEntries) => setForm((current) => ({ ...current, calendarDescriptionEntries }))}
					loading={localesLoading}
					error={localesError}
				/>
				<LocalizedFieldsEditor
					idPrefix="dialog-league-data-source"
					label="Data source note"
					description="Optional source note used by the public season detail view."
					entries={form.dataSourceNoteEntries}
					localeOptions={locales}
					onChange={(dataSourceNoteEntries) => setForm((current) => ({ ...current, dataSourceNoteEntries }))}
					loading={localesLoading}
					error={localesError}
				/>
				<LocalizedFieldsEditor
					idPrefix="dialog-league-notes"
					label="Notes"
					description="Optional internal notes."
					entries={form.notesEntries}
					localeOptions={locales}
					onChange={(notesEntries) => setForm((current) => ({ ...current, notesEntries }))}
					loading={localesLoading}
					error={localesError}
				/>
				{error ? <p className="text-sm text-danger">{error}</p> : null}
				<div className="flex justify-end gap-3">
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancel</Button>
					<Button disabled={pending || localesLoading || !!localesError || locales.length === 0} type="submit">{pending ? 'Creating...' : 'Create league'}</Button>
				</div>
			</form>
		</Dialog>
	)
}

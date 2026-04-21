import { useEffect, useState } from 'react'

import { useAdminLocales } from '@/components/admin-locales-provider'
import { useAuth } from '@/components/use-auth'
import { LocalizedFieldsEditor } from '@/components/localized-fields-editor'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { entriesFromLocalizedText, entriesToLocalizedText, type LocalizedFieldEntry } from '@/lib/localized-fields'
import type { LeagueItem } from '@/types'

type EditLeagueDialogProps = {
	league: LeagueItem | null
	open: boolean
	onOpenChange: (open: boolean) => void
	onSaved: () => Promise<void>
}

type LeagueFormState = {
	id: string
	slug: string
	show: boolean
	syncInterval: string
	nameEntries: LocalizedFieldEntry[]
	calendarDescriptionEntries: LocalizedFieldEntry[]
	dataSourceNoteEntries: LocalizedFieldEntry[]
	notesEntries: LocalizedFieldEntry[]
}

function mapLeagueToForm(league: LeagueItem, locales: Parameters<typeof entriesFromLocalizedText>[1]): LeagueFormState {
	return {
		id: String(league.id),
		slug: league.slug,
		show: league.show,
		syncInterval: league.syncInterval,
		nameEntries: entriesFromLocalizedText(league.name, locales),
		calendarDescriptionEntries: entriesFromLocalizedText(league.calendarDescription, locales),
		dataSourceNoteEntries: entriesFromLocalizedText(league.dataSourceNote, locales),
		notesEntries: entriesFromLocalizedText(league.notes, locales),
	}
}

export function EditLeagueDialog({ league, open, onOpenChange, onSaved }: EditLeagueDialogProps) {
	const { token } = useAuth()
	const { locales, loading: localesLoading, error: localesError } = useAdminLocales()
	const [form, setForm] = useState<LeagueFormState>({
		id: '',
		slug: '',
		show: false,
		syncInterval: '@daily',
		nameEntries: [{ locale: 'en', value: '' }],
		calendarDescriptionEntries: [],
		dataSourceNoteEntries: [],
		notesEntries: [],
	})
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!open || !league) {
			return
		}
		setForm(mapLeagueToForm(league, locales))
		setError(null)
	}, [league, locales, open])

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!token || !league) {
			return
		}
		setPending(true)
		setError(null)
		try {
			await api.updateLeague(token, league.sportSlug, league.slug, {
				slug: form.slug,
				name: entriesToLocalizedText(form.nameEntries),
				show: form.show,
				syncInterval: form.syncInterval,
				calendarDescription: entriesToLocalizedText(form.calendarDescriptionEntries),
				dataSourceNote: entriesToLocalizedText(form.dataSourceNoteEntries),
				notes: entriesToLocalizedText(form.notesEntries),
			})
			await onSaved()
			onOpenChange(false)
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'update failed')
		} finally {
			setPending(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange} title="Edit league" description="Update the local league fields that drive sync and calendar presentation.">
			<form className="space-y-5" onSubmit={handleSubmit}>
				<div className="grid gap-4 md:grid-cols-3">
					<div><Label htmlFor="edit-league-id">TheSportsDB id</Label><Input disabled id="edit-league-id" value={form.id} /></div>
					<div><Label htmlFor="edit-league-slug">Slug</Label><Input id="edit-league-slug" required value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} /></div>
					<div><Label htmlFor="edit-league-sync">Sync interval</Label><Input id="edit-league-sync" required value={form.syncInterval} onChange={(event) => setForm((current) => ({ ...current, syncInterval: event.target.value }))} /></div>
				</div>
				<div className="flex items-start gap-3 rounded-2xl border border-line/70 bg-shell/55 px-4 py-3">
					<Checkbox id="edit-league-show" checked={form.show} onCheckedChange={(checked) => setForm((current) => ({ ...current, show: checked === true }))} />
					<div className="space-y-1">
						<Label htmlFor="edit-league-show">Show on public site</Label>
						<p className="text-sm text-muted">Turn this on only when the league should be visible to frontend users.</p>
					</div>
				</div>
				<LocalizedFieldsEditor idPrefix="edit-league-name" label="Localized name" entries={form.nameEntries} localeOptions={locales} onChange={(nameEntries) => setForm((current) => ({ ...current, nameEntries }))} loading={localesLoading} error={localesError} required />
				<LocalizedFieldsEditor idPrefix="edit-league-calendar-description" label="Calendar description" entries={form.calendarDescriptionEntries} localeOptions={locales} onChange={(calendarDescriptionEntries) => setForm((current) => ({ ...current, calendarDescriptionEntries }))} loading={localesLoading} error={localesError} />
				<LocalizedFieldsEditor idPrefix="edit-league-data-source-note" label="Data source note" entries={form.dataSourceNoteEntries} localeOptions={locales} onChange={(dataSourceNoteEntries) => setForm((current) => ({ ...current, dataSourceNoteEntries }))} loading={localesLoading} error={localesError} />
				<LocalizedFieldsEditor idPrefix="edit-league-notes" label="Notes" entries={form.notesEntries} localeOptions={locales} onChange={(notesEntries) => setForm((current) => ({ ...current, notesEntries }))} loading={localesLoading} error={localesError} />
				{error ? <p className="text-sm text-danger">{error}</p> : null}
				<div className="flex justify-end gap-3">
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancel</Button>
					<Button disabled={pending || localesLoading || !!localesError || locales.length === 0} type="submit">{pending ? 'Saving...' : 'Save league'}</Button>
				</div>
			</form>
		</Dialog>
	)
}

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
import { createEmptyLocalizedEntry, entriesFromText, entriesToLocalizedText, type LocalizedFieldEntry } from '@/lib/localized-fields'
import type { ExternalLeagueOption, ExternalLeagueLookup } from '@/types'

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
	syncInterval: '@daily',
	nameEntries: [{ locale: 'en', value: '' }],
	calendarDescriptionEntries: [],
	dataSourceNoteEntries: [],
	notesEntries: [],
}

export function AddLeagueDialog({ sportSlug, open, onOpenChange, onCreated }: AddLeagueDialogProps) {
	const { token } = useAuth()
	const { locales, loading: localesLoading, error: localesError, preferredLocaleCode } = useAdminLocales()
	const [options, setOptions] = useState<ExternalLeagueOption[]>([])
	const [selectedID, setSelectedID] = useState('')
	const [lookup, setLookup] = useState<ExternalLeagueLookup | null>(null)
	const [form, setForm] = useState<LeagueFormState>(emptyLeagueForm)
	const [loadingOptions, setLoadingOptions] = useState(false)
	const [loadingLookup, setLoadingLookup] = useState(false)
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!open || !token) {
			return
		}
		let active = true
		setLoadingOptions(true)
		setError(null)
		void api.listTheSportsDBLeagues(token, sportSlug)
			.then((response) => {
				if (!active) {
					return
				}
				setOptions(response.items)
				const firstItem = response.items[0]
				if (firstItem) {
					setSelectedID(String(firstItem.id))
				}
			})
			.catch((caught) => {
				if (!active) {
					return
				}
				setOptions([])
				setForm({ ...emptyLeagueForm, nameEntries: [createEmptyLocalizedEntry(locales)] })
				setError(caught instanceof Error ? caught.message : 'load failed')
			})
			.finally(() => {
				if (active) {
					setLoadingOptions(false)
				}
			})
		return () => {
			active = false
		}
	}, [locales, open, sportSlug, token])

	useEffect(() => {
		if (!open || !token || !selectedID) {
			return
		}
		let active = true
		setLoadingLookup(true)
		setError(null)
		void api.lookupTheSportsDBLeague(token, Number(selectedID))
			.then((response) => {
				if (!active) {
					return
				}
				setLookup(response)
				setForm({
					id: String(response.id),
					slug: response.suggestedSlug,
					show: false,
					syncInterval: response.syncInterval || '@daily',
					nameEntries: entriesFromText(response.name, preferredLocaleCode),
					calendarDescriptionEntries: entriesFromText(response.calendarDescription, preferredLocaleCode),
					dataSourceNoteEntries: entriesFromText(response.dataSourceNote, preferredLocaleCode),
					notesEntries: [],
				})
			})
			.catch((caught) => {
				if (!active) {
					return
				}
				setLookup(null)
				setForm({ ...emptyLeagueForm, nameEntries: [createEmptyLocalizedEntry(locales)] })
				setError(caught instanceof Error ? caught.message : 'lookup failed')
			})
			.finally(() => {
				if (active) {
					setLoadingLookup(false)
				}
			})
		return () => {
			active = false
		}
	}, [locales, open, preferredLocaleCode, selectedID, token])

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
				syncInterval: form.syncInterval,
				calendarDescription: entriesToLocalizedText(form.calendarDescriptionEntries),
				dataSourceNote: entriesToLocalizedText(form.dataSourceNoteEntries),
				notes: entriesToLocalizedText(form.notesEntries),
			})
			await onCreated()
			onOpenChange(false)
			setLookup(null)
			setSelectedID('')
			setForm({ ...emptyLeagueForm, nameEntries: [createEmptyLocalizedEntry(locales)] })
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'create failed')
		} finally {
			setPending(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange} title="Create league" description="Choose a league from TheSportsDB, run lookup automatically, then adjust the local fields before saving.">
			<form className="space-y-5" onSubmit={handleSubmit}>
				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<Label htmlFor="external-league">TheSportsDB league</Label>
						<Select
							disabled={loadingOptions || options.length === 0}
							value={selectedID}
							onValueChange={setSelectedID}
						>
							<SelectTrigger id="external-league">
								<SelectValue placeholder={loadingOptions ? 'Loading leagues...' : 'Select a league'} />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{options.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}
								</SelectGroup>
							</SelectContent>
						</Select>
					</div>
					<div className="rounded-2xl border border-line/70 bg-shell/55 px-4 py-3 text-sm text-muted">
						<p className="font-medium text-ink">Remote summary</p>
						<p className="mt-1">{lookup ? `${lookup.sport}${lookup.country ? ` · ${lookup.country}` : ''}${lookup.currentSeason ? ` · current season ${lookup.currentSeason}` : ''}` : 'Choose a league to load lookup details.'}</p>
					</div>
				</div>
				<div className="grid gap-4 md:grid-cols-3">
					<div><Label htmlFor="league-id-dialog">TheSportsDB id</Label><Input id="league-id-dialog" required value={form.id} onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))} /></div>
					<div><Label htmlFor="league-slug-dialog">Slug</Label><Input id="league-slug-dialog" required value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} /></div>
					<div><Label htmlFor="league-sync-dialog">Sync interval</Label><Input id="league-sync-dialog" required value={form.syncInterval} onChange={(event) => setForm((current) => ({ ...current, syncInterval: event.target.value }))} /></div>
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
					description="The lookup fills an english value. You can add more locales if needed."
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
					description="Suggested from TheSportsDB league lookup."
					entries={form.calendarDescriptionEntries}
					localeOptions={locales}
					onChange={(calendarDescriptionEntries) => setForm((current) => ({ ...current, calendarDescriptionEntries }))}
					loading={localesLoading}
					error={localesError}
				/>
				<LocalizedFieldsEditor
					idPrefix="dialog-league-data-source"
					label="Data source note"
					description="Suggested source note used by the public season detail view."
					entries={form.dataSourceNoteEntries}
					localeOptions={locales}
					onChange={(dataSourceNoteEntries) => setForm((current) => ({ ...current, dataSourceNoteEntries }))}
					loading={localesLoading}
					error={localesError}
				/>
				<LocalizedFieldsEditor
					idPrefix="dialog-league-notes"
					label="Notes"
					description="Optional internal notes. This remains fully manual."
					entries={form.notesEntries}
					localeOptions={locales}
					onChange={(notesEntries) => setForm((current) => ({ ...current, notesEntries }))}
					loading={localesLoading}
					error={localesError}
				/>
				{error ? <p className="text-sm text-danger">{error}</p> : null}
				<div className="flex justify-end gap-3">
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancel</Button>
					<Button disabled={pending || loadingOptions || loadingLookup || !selectedID || localesLoading || !!localesError || locales.length === 0} type="submit">{pending ? 'Creating...' : 'Create league'}</Button>
				</div>
			</form>
		</Dialog>
	)
}

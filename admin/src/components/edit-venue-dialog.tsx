import { useEffect, useState } from 'react'

import { useAdminLocales } from '@/components/admin-locales-provider'
import { LocalizedFieldsEditor } from '@/components/localized-fields-editor'
import { useAuth } from '@/components/use-auth'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { createEmptyLocalizedEntry, entriesFromLocalizedText, entriesToLocalizedText, type LocalizedFieldEntry } from '@/lib/localized-fields'
import type { AdminVenueItem } from '@/types'

type EditVenueDialogProps = {
	venue: AdminVenueItem | null
	open: boolean
	onOpenChange: (open: boolean) => void
	onSaved: () => Promise<void>
}

type VenueFormState = {
	id: string
	nameEntries: LocalizedFieldEntry[]
	cityEntries: LocalizedFieldEntry[]
	countryEntries: LocalizedFieldEntry[]
}

function buildEmptyForm(locales: Parameters<typeof entriesFromLocalizedText>[1]): VenueFormState {
	return {
		id: '',
		nameEntries: [createEmptyLocalizedEntry(locales)],
		cityEntries: [createEmptyLocalizedEntry(locales)],
		countryEntries: [createEmptyLocalizedEntry(locales)],
	}
}

function mapVenueToForm(venue: AdminVenueItem, locales: Parameters<typeof entriesFromLocalizedText>[1]): VenueFormState {
	return {
		id: String(venue.id),
		nameEntries: entriesFromLocalizedText(venue.name, locales),
		cityEntries: entriesFromLocalizedText(venue.city, locales),
		countryEntries: entriesFromLocalizedText(venue.country, locales),
	}
}

export function EditVenueDialog({ venue, open, onOpenChange, onSaved }: EditVenueDialogProps) {
	const { token } = useAuth()
	const { locales, loading: localesLoading, error: localesError } = useAdminLocales()
	const [form, setForm] = useState<VenueFormState>(buildEmptyForm([]))
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const isEditing = venue !== null

	useEffect(() => {
		if (!open) {
			setForm(buildEmptyForm(locales))
			setError(null)
			return
		}
		setForm(venue ? mapVenueToForm(venue, locales) : buildEmptyForm(locales))
		setError(null)
	}, [locales, open, venue])

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!token) {
			return
		}
		const venueID = Number(form.id)
		if (!Number.isInteger(venueID) || venueID <= 0) {
			setError('Venue id must be a positive integer')
			return
		}
		setPending(true)
		setError(null)
		try {
			const payload = {
				name: entriesToLocalizedText(form.nameEntries),
				city: entriesToLocalizedText(form.cityEntries),
				country: entriesToLocalizedText(form.countryEntries),
			}
			if (isEditing) {
				await api.updateVenue(token, venueID, payload)
			} else {
				await api.createVenue(token, { id: venueID, ...payload })
			}
			await onSaved()
			onOpenChange(false)
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : isEditing ? 'update failed' : 'create failed')
		} finally {
			setPending(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange} title={isEditing ? 'Edit venue' : 'Add venue'} description="Manage localized venue, city, and country names used by matches and sync refreshes." contentClassName="max-w-3xl">
			<form className="space-y-5" onSubmit={handleSubmit}>
				<div>
					<Label htmlFor="edit-venue-id">Venue id</Label>
					<Input id="edit-venue-id" type="number" min="1" disabled={isEditing} value={form.id} onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))} />
				</div>
				<LocalizedFieldsEditor idPrefix="edit-venue-name" label="Localized name" entries={form.nameEntries} localeOptions={locales} onChange={(nameEntries) => setForm((current) => ({ ...current, nameEntries }))} loading={localesLoading} error={localesError} required />
				<LocalizedFieldsEditor idPrefix="edit-venue-city" label="Localized city" entries={form.cityEntries} localeOptions={locales} onChange={(cityEntries) => setForm((current) => ({ ...current, cityEntries }))} loading={localesLoading} />
				<LocalizedFieldsEditor idPrefix="edit-venue-country" label="Localized country" entries={form.countryEntries} localeOptions={locales} onChange={(countryEntries) => setForm((current) => ({ ...current, countryEntries }))} loading={localesLoading} />
				{error ? <p className="text-sm text-danger">{error}</p> : null}
				<div className="flex justify-end gap-3">
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancel</Button>
					<Button disabled={pending || localesLoading || !!localesError || locales.length === 0} type="submit">{pending ? 'Saving...' : (isEditing ? 'Save venue' : 'Create venue')}</Button>
				</div>
			</form>
		</Dialog>
	)
}

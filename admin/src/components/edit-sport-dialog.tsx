import { useEffect, useState } from 'react'

import { useAdminLocales } from '@/components/admin-locales-provider'
import { useAuth } from '@/components/use-auth'
import { LocalizedFieldsEditor } from '@/components/localized-fields-editor'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { entriesFromLocalizedText, entriesToLocalizedText, type LocalizedFieldEntry } from '@/lib/localized-fields'
import type { AdminLocaleItem, SportItem } from '@/types'

type EditSportDialogProps = {
	sport: SportItem | null
	open: boolean
	onOpenChange: (open: boolean) => void
	onSaved: () => Promise<void>
}

type SportFormState = {
	id: string
	slug: string
	nameEntries: LocalizedFieldEntry[]
}

function mapSportToForm(sport: SportItem, localeOptions: AdminLocaleItem[]): SportFormState {
	return {
		id: String(sport.id),
		slug: sport.slug,
		nameEntries: entriesFromLocalizedText(sport.name, localeOptions),
	}
}

export function EditSportDialog({ sport, open, onOpenChange, onSaved }: EditSportDialogProps) {
	const { token } = useAuth()
	const { locales, loading: localesLoading, error: localesError } = useAdminLocales()
	const [form, setForm] = useState<SportFormState>({ id: '', slug: '', nameEntries: [{ locale: 'en', value: '' }] })
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!open || !sport) {
			return
		}
		setForm(mapSportToForm(sport, locales))
		setError(null)
	}, [locales, open, sport])

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!token || !sport) {
			return
		}
		setPending(true)
		setError(null)
		try {
			await api.updateSport(token, sport.slug, {
				slug: form.slug,
				name: entriesToLocalizedText(form.nameEntries),
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
		<Dialog open={open} onOpenChange={onOpenChange} title="Edit sport" description="Update the local sport metadata. External source selection is only used during creation.">
			<form className="space-y-5" onSubmit={handleSubmit}>
				<div className="grid gap-4 md:grid-cols-2">
					<div><Label htmlFor="edit-sport-id">Sport id</Label><Input disabled id="edit-sport-id" value={form.id} /></div>
					<div><Label htmlFor="edit-sport-slug">Slug</Label><Input id="edit-sport-slug" required value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} /></div>
				</div>
				<LocalizedFieldsEditor idPrefix="edit-sport-name" label="Localized name" entries={form.nameEntries} localeOptions={locales} onChange={(nameEntries) => setForm((current) => ({ ...current, nameEntries }))} loading={localesLoading} error={localesError} required />
				{error ? <p className="text-sm text-danger">{error}</p> : null}
				<div className="flex justify-end gap-3">
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancel</Button>
					<Button disabled={pending || localesLoading || !!localesError || locales.length === 0} type="submit">{pending ? 'Saving...' : 'Save sport'}</Button>
				</div>
			</form>
		</Dialog>
	)
}

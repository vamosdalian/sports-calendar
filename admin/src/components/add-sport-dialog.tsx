import { useEffect, useState } from 'react'

import { useAdminLocales } from '@/components/admin-locales-provider'
import { useAuth } from '@/components/use-auth'
import { LocalizedFieldsEditor } from '@/components/localized-fields-editor'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { createEmptyLocalizedEntry, entriesToLocalizedText, type LocalizedFieldEntry } from '@/lib/localized-fields'

type AddSportDialogProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	onCreated: () => Promise<void>
}

type SportFormState = {
	id: string
	slug: string
	nameEntries: LocalizedFieldEntry[]
}

const emptyForm: SportFormState = {
	id: '',
	slug: '',
	nameEntries: [{ locale: 'en', value: '' }],
}

export function AddSportDialog({ open, onOpenChange, onCreated }: AddSportDialogProps) {
	const { token } = useAuth()
	const { locales, loading: localesLoading, error: localesError } = useAdminLocales()
	const [form, setForm] = useState<SportFormState>(emptyForm)
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!open) {
			return
		}
		setError(null)
		setForm({ ...emptyForm, nameEntries: [createEmptyLocalizedEntry(locales)] })
	}, [locales, open])

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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
			await onCreated()
			onOpenChange(false)
			setForm({ ...emptyForm, nameEntries: [createEmptyLocalizedEntry(locales)] })
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'create failed')
		} finally {
			setPending(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange} title="Create sport" description="Enter the sport id, slug, and localized name, then save it into the local catalog.">
			<form className="space-y-5" onSubmit={handleSubmit}>
				<div className="grid gap-4 md:grid-cols-2">
					<div><Label htmlFor="sport-id-dialog">Sport id</Label><Input id="sport-id-dialog" required value={form.id} onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))} /></div>
					<div><Label htmlFor="sport-slug-dialog">Slug</Label><Input id="sport-slug-dialog" required value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} /></div>
				</div>
				<LocalizedFieldsEditor
					idPrefix="dialog-sport-name"
					label="Localized name"
					description="Add or edit locales before saving."
					entries={form.nameEntries}
					localeOptions={locales}
					onChange={(nameEntries) => setForm((current) => ({ ...current, nameEntries }))}
					loading={localesLoading}
					error={localesError}
					required
				/>
				{error ? <p className="text-sm text-danger">{error}</p> : null}
				<div className="flex justify-end gap-3">
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancel</Button>
					<Button disabled={pending || localesLoading || !!localesError || locales.length === 0} type="submit">{pending ? 'Creating...' : 'Create sport'}</Button>
				</div>
			</form>
		</Dialog>
	)
}

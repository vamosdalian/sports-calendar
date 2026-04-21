import { useEffect, useState } from 'react'

import { useAdminLocales } from '@/components/admin-locales-provider'
import { useAuth } from '@/components/use-auth'
import { LocalizedFieldsEditor } from '@/components/localized-fields-editor'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { createEmptyLocalizedEntry, entriesFromText, entriesToLocalizedText, type LocalizedFieldEntry } from '@/lib/localized-fields'
import type { ExternalSportOption } from '@/types'

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
	const { locales, loading: localesLoading, error: localesError, preferredLocaleCode } = useAdminLocales()
	const [options, setOptions] = useState<ExternalSportOption[]>([])
	const [selectedID, setSelectedID] = useState('')
	const [form, setForm] = useState<SportFormState>(emptyForm)
	const [loading, setLoading] = useState(false)
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!open || !token) {
			return
		}
		let active = true
		setLoading(true)
		setError(null)
		void api.listTheSportsDBSports(token)
			.then((response) => {
				if (!active) {
					return
				}
				setOptions(response.items)
				const firstItem = response.items[0]
				if (firstItem) {
					applySelection(firstItem)
				}
			})
			.catch((caught) => {
				if (!active) {
					return
				}
				setOptions([])
				setForm({ ...emptyForm, nameEntries: [createEmptyLocalizedEntry(locales)] })
				setError(caught instanceof Error ? caught.message : 'load failed')
			})
			.finally(() => {
				if (active) {
					setLoading(false)
				}
			})
		return () => {
			active = false
		}
	}, [locales, open, token])

	function applySelection(item: ExternalSportOption) {
		setSelectedID(String(item.id))
		setForm({
			id: String(item.id),
			slug: item.suggestedSlug,
			nameEntries: entriesFromText(item.name, preferredLocaleCode),
		})
	}

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
			setSelectedID('')
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'create failed')
		} finally {
			setPending(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange} title="Create sport" description="Choose a sport from TheSportsDB, review the suggested values, then save it into the local catalog.">
			<form className="space-y-5" onSubmit={handleSubmit}>
				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<Label htmlFor="external-sport">TheSportsDB sport</Label>
						<Select
							disabled={loading || options.length === 0}
							value={selectedID}
							onValueChange={(value) => {
								const next = options.find((item) => String(item.id) === value)
								if (next) {
									applySelection(next)
								}
							}}
						>
							<SelectTrigger id="external-sport">
								<SelectValue placeholder={loading ? 'Loading sports...' : 'Select a sport'} />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{options.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}
								</SelectGroup>
							</SelectContent>
						</Select>
					</div>
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					<div><Label htmlFor="sport-id-dialog">Sport id</Label><Input id="sport-id-dialog" required value={form.id} onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))} /></div>
					<div><Label htmlFor="sport-slug-dialog">Slug</Label><Input id="sport-slug-dialog" required value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} /></div>
				</div>
				<LocalizedFieldsEditor
					idPrefix="dialog-sport-name"
					label="Localized name"
					description="The selection fills an english name by default. You can add or edit locales before saving."
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
					<Button disabled={pending || loading || localesLoading || !!localesError || locales.length === 0} type="submit">{pending ? 'Creating...' : 'Create sport'}</Button>
				</div>
			</form>
		</Dialog>
	)
}

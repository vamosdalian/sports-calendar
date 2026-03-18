import { useEffect, useState } from 'react'

import { useAuth } from '@/components/use-auth'
import { LocalizedFieldsEditor } from '@/components/localized-fields-editor'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { api } from '@/lib/api'
import { entriesFromText, entriesToLocalizedText, type LocalizedFieldEntry } from '@/lib/localized-fields'
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
				setForm(emptyForm)
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
	}, [open, token])

	function applySelection(item: ExternalSportOption) {
		setSelectedID(String(item.id))
		setForm({
			id: String(item.id),
			slug: item.suggestedSlug,
			nameEntries: entriesFromText(item.name),
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
			setForm(emptyForm)
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
							id="external-sport"
							disabled={loading || options.length === 0}
							value={selectedID}
							onChange={(event) => {
								const next = options.find((item) => String(item.id) === event.target.value)
								if (next) {
									applySelection(next)
								}
							}}
						>
							<option value="">{loading ? 'Loading sports...' : 'Select a sport'}</option>
							{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
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
					onChange={(nameEntries) => setForm((current) => ({ ...current, nameEntries }))}
					required
				/>
				{error ? <p className="text-sm text-danger">{error}</p> : null}
				<div className="flex justify-end gap-3">
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancel</Button>
					<Button disabled={pending || loading} type="submit">{pending ? 'Creating...' : 'Create sport'}</Button>
				</div>
			</form>
		</Dialog>
	)
}
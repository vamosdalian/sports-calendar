import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { LocalizedFieldEntry } from '@/lib/localized-fields'
import type { AdminLocaleItem } from '@/types'

type LocalizedFieldsEditorProps = {
	idPrefix: string
	label: string
	entries: LocalizedFieldEntry[]
	onChange: (entries: LocalizedFieldEntry[]) => void
	localeOptions: AdminLocaleItem[]
	description?: string
	required?: boolean
	disabled?: boolean
	loading?: boolean
	error?: string | null
}

export function LocalizedFieldsEditor({
	idPrefix,
	label,
	entries,
	onChange,
	localeOptions,
	description,
	required = false,
	disabled = false,
	loading = false,
	error = null,
}: LocalizedFieldsEditorProps) {
	function updateEntry(index: number, patch: Partial<LocalizedFieldEntry>) {
		onChange(entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)))
	}

	function addEntry() {
		const usedLocales = new Set(entries.map((entry) => entry.locale))
		const nextLocale = localeOptions.find((option) => !usedLocales.has(option.code))
		if (!nextLocale) {
			return
		}
		onChange([...entries, { locale: nextLocale.code, value: '' }])
	}

	function removeEntry(index: number) {
		onChange(entries.filter((_, entryIndex) => entryIndex !== index))
	}

	const usedLocales = new Set(entries.map((entry) => entry.locale))
	const canAddLocale = !disabled && !loading && localeOptions.some((option) => !usedLocales.has(option.code))
	return (
		<div className="space-y-3 rounded-lg border border-line/70 bg-shell/55 p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<Label>{label}</Label>
					{error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
					{!error && description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
				</div>
				<Button disabled={!canAddLocale} onClick={addEntry} size="sm" type="button" variant="outline">Add locale</Button>
			</div>
			{loading ? <p className="text-sm text-muted">Loading locale options...</p> : null}
			{!loading && entries.length === 0 ? <p className="text-sm text-muted">No locales added yet.</p> : null}
			<div className="space-y-3">
				{entries.map((entry, index) => (
					<div key={`${idPrefix}-${index}`} className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)_auto] md:items-end">
						<div>
							<Label htmlFor={`${idPrefix}-locale-${index}`}>Locale</Label>
							<Select
								disabled={disabled || loading}
								value={entry.locale}
								onValueChange={(value) => updateEntry(index, { locale: value })}
							>
								<SelectTrigger id={`${idPrefix}-locale-${index}`}>
									<SelectValue placeholder="Select locale" />
								</SelectTrigger>
								<SelectContent>
									{localeOptions
										.filter((option) => option.code === entry.locale || !entries.some((item, itemIndex) => itemIndex !== index && item.locale === option.code))
										.map((option) => (
											<SelectItem key={option.code} value={option.code}>
												{option.label} ({option.code})
											</SelectItem>
										))}
									{entry.locale && !localeOptions.some((option) => option.code === entry.locale) ? (
										<SelectItem value={entry.locale}>{entry.locale}</SelectItem>
									) : null}
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label htmlFor={`${idPrefix}-value-${index}`}>Text</Label>
							<Input
								id={`${idPrefix}-value-${index}`}
								placeholder={required && index === 0 ? 'Required value' : 'Localized text'}
								disabled={disabled || loading}
								required={required && index === 0}
								value={entry.value}
								onChange={(event) => updateEntry(index, { value: event.target.value })}
							/>
						</div>
						<Button disabled={disabled || loading} onClick={() => removeEntry(index)} size="sm" type="button" variant="ghost">Remove</Button>
					</div>
				))}
			</div>
		</div>
	)
}

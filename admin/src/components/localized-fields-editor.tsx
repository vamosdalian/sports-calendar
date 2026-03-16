import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { LocalizedFieldEntry } from '@/lib/localized-fields'

type LocalizedFieldsEditorProps = {
	idPrefix: string
	label: string
	entries: LocalizedFieldEntry[]
	onChange: (entries: LocalizedFieldEntry[]) => void
	description?: string
	required?: boolean
}

export function LocalizedFieldsEditor({
	idPrefix,
	label,
	entries,
	onChange,
	description,
	required = false,
}: LocalizedFieldsEditorProps) {
	function updateEntry(index: number, patch: Partial<LocalizedFieldEntry>) {
		onChange(entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)))
	}

	function addEntry() {
		onChange([...entries, { locale: '', value: '' }])
	}

	function removeEntry(index: number) {
		onChange(entries.filter((_, entryIndex) => entryIndex !== index))
	}

	return (
		<div className="space-y-3 rounded-lg border border-line/70 bg-shell/55 p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<Label>{label}</Label>
					{description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
				</div>
				<Button onClick={addEntry} size="sm" type="button" variant="outline">Add locale</Button>
			</div>
			{entries.length === 0 ? <p className="text-sm text-muted">No locales added yet.</p> : null}
			<div className="space-y-3">
				{entries.map((entry, index) => (
					<div key={`${idPrefix}-${index}`} className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)_auto] md:items-end">
						<div>
							<Label htmlFor={`${idPrefix}-locale-${index}`}>Locale</Label>
							<Input
								id={`${idPrefix}-locale-${index}`}
								placeholder="en"
								required={required && index === 0}
								value={entry.locale}
								onChange={(event) => updateEntry(index, { locale: event.target.value })}
							/>
						</div>
						<div>
							<Label htmlFor={`${idPrefix}-value-${index}`}>Text</Label>
							<Input
								id={`${idPrefix}-value-${index}`}
								placeholder={required && index === 0 ? 'Required value' : 'Localized text'}
								required={required && index === 0}
								value={entry.value}
								onChange={(event) => updateEntry(index, { value: event.target.value })}
							/>
						</div>
						<Button onClick={() => removeEntry(index)} size="sm" type="button" variant="ghost">Remove</Button>
					</div>
				))}
			</div>
		</div>
	)
}
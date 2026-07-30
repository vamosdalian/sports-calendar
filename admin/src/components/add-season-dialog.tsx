import { useEffect, useState } from 'react'

import { useAuth } from '@/components/use-auth'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

type AddSeasonDialogProps = {
	sportSlug: string
	leagueSlug: string
	open: boolean
	onOpenChange: (open: boolean) => void
	onCreated: (seasonSlug: string) => Promise<void>
}

type SeasonFormState = {
	slug: string
	label: string
	show: boolean
	startYear: string
	endYear: string
	defaultMatchDurationMinutes: string
}

const emptySeasonForm: SeasonFormState = {
	slug: '',
	label: '',
	show: false,
	startYear: '',
	endYear: '',
	defaultMatchDurationMinutes: '120',
}

export function AddSeasonDialog({ sportSlug, leagueSlug, open, onOpenChange, onCreated }: AddSeasonDialogProps) {
	const { token } = useAuth()
	const [form, setForm] = useState<SeasonFormState>(emptySeasonForm)
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!open) {
			return
		}
		setError(null)
		setForm(emptySeasonForm)
	}, [open])

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!token) {
			return
		}
		setPending(true)
		setError(null)
		try {
			await api.createSeason(token, {
				sportSlug,
				leagueSlug,
				slug: form.slug,
				label: form.label,
				show: form.show,
				startYear: Number(form.startYear),
				endYear: Number(form.endYear),
				defaultMatchDurationMinutes: Number(form.defaultMatchDurationMinutes),
			})
			await onCreated(form.slug)
			onOpenChange(false)
			setForm(emptySeasonForm)
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'create failed')
		} finally {
			setPending(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange} title="Create season" description="Enter the season slug, label, and year range. The slug cannot be changed after creation.">
			<form className="space-y-5" onSubmit={handleSubmit}>
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					<div><Label htmlFor="season-slug-dialog">Slug</Label><Input id="season-slug-dialog" required value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} /></div>
					<div><Label htmlFor="season-label-dialog">Label</Label><Input id="season-label-dialog" required value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} /></div>
					<div><Label htmlFor="season-start-dialog">Start year</Label><Input id="season-start-dialog" required value={form.startYear} onChange={(event) => setForm((current) => ({ ...current, startYear: event.target.value }))} /></div>
					<div><Label htmlFor="season-end-dialog">End year</Label><Input id="season-end-dialog" required value={form.endYear} onChange={(event) => setForm((current) => ({ ...current, endYear: event.target.value }))} /></div>
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					<div><Label htmlFor="season-duration-dialog">Duration minutes</Label><Input id="season-duration-dialog" required value={form.defaultMatchDurationMinutes} onChange={(event) => setForm((current) => ({ ...current, defaultMatchDurationMinutes: event.target.value }))} /></div>
				</div>
				<div className="flex items-start gap-3 rounded-2xl border border-line/70 bg-shell/55 px-4 py-3">
					<Checkbox id="season-show-dialog" checked={form.show} onCheckedChange={(checked) => setForm((current) => ({ ...current, show: checked === true }))} />
					<div className="space-y-1">
						<Label htmlFor="season-show-dialog">Show on public site</Label>
						<p className="text-sm text-muted">Leave this off until the season has passed your backend review and is ready for users.</p>
					</div>
				</div>
				{error ? <p className="text-sm text-danger">{error}</p> : null}
				<div className="flex justify-end gap-3">
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancel</Button>
					<Button disabled={pending} type="submit">{pending ? 'Creating...' : 'Create season'}</Button>
				</div>
			</form>
		</Dialog>
	)
}

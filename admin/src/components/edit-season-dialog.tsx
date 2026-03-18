import { useEffect, useState } from 'react'

import { useAuth } from '@/components/use-auth'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import type { AdminSeasonItem } from '@/types'

type EditSeasonDialogProps = {
	season: AdminSeasonItem | null
	open: boolean
	onOpenChange: (open: boolean) => void
	onSaved: (nextSelectedSeason?: string) => Promise<void>
}

type SeasonFormState = {
	slug: string
	label: string
	startYear: string
	endYear: string
	defaultMatchDurationMinutes: string
}

function mapSeasonToForm(season: AdminSeasonItem): SeasonFormState {
	return {
		slug: season.slug,
		label: season.label,
		startYear: String(season.startYear),
		endYear: String(season.endYear),
		defaultMatchDurationMinutes: String(season.defaultMatchDurationMinutes),
	}
}

export function EditSeasonDialog({ season, open, onOpenChange, onSaved }: EditSeasonDialogProps) {
	const { token } = useAuth()
	const [form, setForm] = useState<SeasonFormState>({ slug: '', label: '', startYear: '', endYear: '', defaultMatchDurationMinutes: '120' })
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!open || !season) {
			return
		}
		setForm(mapSeasonToForm(season))
		setError(null)
	}, [open, season])

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!token || !season) {
			return
		}
		setPending(true)
		setError(null)
		try {
			await api.updateSeason(token, season.sportSlug, season.leagueSlug, season.slug, {
				slug: form.slug,
				label: form.label,
				startYear: Number(form.startYear),
				endYear: Number(form.endYear),
				defaultMatchDurationMinutes: Number(form.defaultMatchDurationMinutes),
			})
			await onSaved(form.slug)
			onOpenChange(false)
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'update failed')
		} finally {
			setPending(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange} title="Edit season" description="Update the local season slug, label, year range, and default match duration.">
			<form className="space-y-5" onSubmit={handleSubmit}>
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					<div><Label htmlFor="edit-season-slug">Slug</Label><Input id="edit-season-slug" required value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} /></div>
					<div><Label htmlFor="edit-season-label">Label</Label><Input id="edit-season-label" required value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} /></div>
					<div><Label htmlFor="edit-season-start-year">Start year</Label><Input id="edit-season-start-year" required value={form.startYear} onChange={(event) => setForm((current) => ({ ...current, startYear: event.target.value }))} /></div>
					<div><Label htmlFor="edit-season-end-year">End year</Label><Input id="edit-season-end-year" required value={form.endYear} onChange={(event) => setForm((current) => ({ ...current, endYear: event.target.value }))} /></div>
				</div>
				<div><Label htmlFor="edit-season-duration">Duration minutes</Label><Input id="edit-season-duration" required value={form.defaultMatchDurationMinutes} onChange={(event) => setForm((current) => ({ ...current, defaultMatchDurationMinutes: event.target.value }))} /></div>
				{error ? <p className="text-sm text-danger">{error}</p> : null}
				<div className="flex justify-end gap-3">
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancel</Button>
					<Button disabled={pending} type="submit">{pending ? 'Saving...' : 'Save season'}</Button>
				</div>
			</form>
		</Dialog>
	)
}
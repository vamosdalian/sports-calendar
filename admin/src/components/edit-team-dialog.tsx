import { useEffect, useState } from 'react'

import { useAdminLocales } from '@/components/admin-locales-provider'
import { LocalizedFieldsEditor } from '@/components/localized-fields-editor'
import { useAuth } from '@/components/use-auth'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { entriesFromLocalizedText, entriesToLocalizedText, type LocalizedFieldEntry } from '@/lib/localized-fields'
import type { AdminTeamItem } from '@/types'

type EditTeamDialogProps = {
	team: AdminTeamItem | null
	sportSlug: string
	leagueSlug: string
	open: boolean
	onOpenChange: (open: boolean) => void
	onSaved: () => Promise<void>
}

type TeamFormState = {
	id: string
	slug: string
	nameEntries: LocalizedFieldEntry[]
}

function mapTeamToForm(team: AdminTeamItem, locales: Parameters<typeof entriesFromLocalizedText>[1]): TeamFormState {
	return {
		id: String(team.id),
		slug: team.slug,
		nameEntries: entriesFromLocalizedText(team.name, locales),
	}
}

export function EditTeamDialog({ team, sportSlug, leagueSlug, open, onOpenChange, onSaved }: EditTeamDialogProps) {
	const { token } = useAuth()
	const { locales, loading: localesLoading, error: localesError } = useAdminLocales()
	const [form, setForm] = useState<TeamFormState>({
		id: '',
		slug: '',
		nameEntries: [{ locale: 'en', value: '' }],
	})
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!open || !team) {
			return
		}
		setForm(mapTeamToForm(team, locales))
		setError(null)
	}, [locales, open, team])

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!token || !team) {
			return
		}
		setPending(true)
		setError(null)
		try {
			await api.updateTeam(token, sportSlug, leagueSlug, team.id, {
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
		<Dialog open={open} onOpenChange={onOpenChange} title="Edit team" description="Update the localized team name used across admin and public match views.">
			<form className="space-y-5" onSubmit={handleSubmit}>
				<div className="grid gap-4 md:grid-cols-2">
					<div><Label htmlFor="edit-team-id">Team id</Label><Input disabled id="edit-team-id" value={form.id} /></div>
					<div><Label htmlFor="edit-team-slug">Slug</Label><Input disabled id="edit-team-slug" value={form.slug} /></div>
				</div>
				<LocalizedFieldsEditor idPrefix="edit-team-name" label="Localized name" entries={form.nameEntries} localeOptions={locales} onChange={(nameEntries) => setForm((current) => ({ ...current, nameEntries }))} loading={localesLoading} error={localesError} required />
				{error ? <p className="text-sm text-danger">{error}</p> : null}
				<div className="flex justify-end gap-3">
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancel</Button>
					<Button disabled={pending || localesLoading || !!localesError || locales.length === 0} type="submit">{pending ? 'Saving...' : 'Save team'}</Button>
				</div>
			</form>
		</Dialog>
	)
}

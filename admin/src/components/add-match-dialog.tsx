import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/components/use-auth'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { pickLocalizedPreview } from '@/lib/localized-fields'
import type { AdminTeamItem } from '@/types'

const UNKNOWN_TEAM_ID = '-1'

type AddMatchDialogProps = {
	sportSlug: string
	leagueSlug: string
	seasonSlug: string
	open: boolean
	onOpenChange: (open: boolean) => void
	onCreated: () => Promise<void>
}

type MatchFormState = {
	homeTeamID: string
	awayTeamID: string
	round: string
	startsAt: string
	status: string
	venue: string
	city: string
	country: string
}

const emptyMatchForm: MatchFormState = {
	homeTeamID: UNKNOWN_TEAM_ID,
	awayTeamID: UNKNOWN_TEAM_ID,
	round: '',
	startsAt: '',
	status: 'scheduled',
	venue: '',
	city: '',
	country: '',
}

export function AddMatchDialog({ sportSlug, leagueSlug, seasonSlug, open, onOpenChange, onCreated }: AddMatchDialogProps) {
	const { token } = useAuth()
	const [teams, setTeams] = useState<AdminTeamItem[]>([])
	const [loading, setLoading] = useState(false)
	const [pending, setPending] = useState(false)
	const [form, setForm] = useState<MatchFormState>(emptyMatchForm)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!open || !token) {
			return
		}
		let active = true
		setLoading(true)
		setError(null)
		void api.listAdminTeams(token, sportSlug, leagueSlug)
			.then((response) => {
				if (!active) {
					return
				}
				setTeams(response.items)
			})
			.catch((caught) => {
				if (!active) {
					return
				}
				setTeams([])
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
	}, [leagueSlug, open, sportSlug, token])

	const teamOptions = useMemo(() => ([
		{ id: UNKNOWN_TEAM_ID, label: 'Unknown team' },
		...teams.map((team) => ({ id: String(team.id), label: pickLocalizedPreview(team.name) })),
	]), [teams])

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!token) {
			return
		}
		setPending(true)
		setError(null)
		try {
			await api.createMatch(token, {
				sportSlug,
				leagueSlug,
				seasonSlug,
				homeTeamID: Number(form.homeTeamID),
				awayTeamID: Number(form.awayTeamID),
				round: { en: form.round },
				startsAt: new Date(form.startsAt).toISOString(),
				status: form.status,
				venue: form.venue ? { en: form.venue } : {},
				city: form.city ? { en: form.city } : {},
				country: form.country ? { en: form.country } : {},
			})
			await onCreated()
			onOpenChange(false)
			setForm(emptyMatchForm)
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'create failed')
		} finally {
			setPending(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange} title="Add match" description="Create a single manual fixture for this season. Unknown-team slots use the shared sentinel value instead of fake teams." contentClassName="max-w-2xl">
			<form className="space-y-5" onSubmit={handleSubmit}>
				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<Label htmlFor="match-home-team">Home team</Label>
						<Select value={form.homeTeamID} onValueChange={(homeTeamID) => setForm((current) => ({ ...current, homeTeamID }))}>
							<SelectTrigger id="match-home-team">
								<SelectValue placeholder={loading ? 'Loading teams...' : 'Select home team'} />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{teamOptions.map((team) => <SelectItem key={team.id} value={team.id}>{team.label}</SelectItem>)}
								</SelectGroup>
							</SelectContent>
						</Select>
					</div>
					<div>
						<Label htmlFor="match-away-team">Away team</Label>
						<Select value={form.awayTeamID} onValueChange={(awayTeamID) => setForm((current) => ({ ...current, awayTeamID }))}>
							<SelectTrigger id="match-away-team">
								<SelectValue placeholder={loading ? 'Loading teams...' : 'Select away team'} />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{teamOptions.map((team) => <SelectItem key={team.id} value={team.id}>{team.label}</SelectItem>)}
								</SelectGroup>
							</SelectContent>
						</Select>
					</div>
				</div>
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					<div><Label htmlFor="match-round">Round</Label><Input id="match-round" required value={form.round} onChange={(event) => setForm((current) => ({ ...current, round: event.target.value }))} /></div>
					<div><Label htmlFor="match-starts-at">Kickoff</Label><Input id="match-starts-at" required type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></div>
					<div>
						<Label htmlFor="match-status">Status</Label>
						<Select value={form.status} onValueChange={(status) => setForm((current) => ({ ...current, status }))}>
							<SelectTrigger id="match-status"><SelectValue placeholder="Select status" /></SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectItem value="scheduled">Scheduled</SelectItem>
									<SelectItem value="finished">Finished</SelectItem>
									<SelectItem value="postponed">Postponed</SelectItem>
									<SelectItem value="cancelled">Cancelled</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>
					</div>
					<div><Label htmlFor="match-country">Country</Label><Input id="match-country" value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} /></div>
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					<div><Label htmlFor="match-venue">Venue</Label><Input id="match-venue" value={form.venue} onChange={(event) => setForm((current) => ({ ...current, venue: event.target.value }))} /></div>
					<div><Label htmlFor="match-city">City</Label><Input id="match-city" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} /></div>
				</div>
				{error ? <p className="text-sm text-danger">{error}</p> : null}
				<div className="flex justify-end gap-3">
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancel</Button>
					<Button disabled={pending || loading} type="submit">{pending ? 'Creating...' : 'Create match'}</Button>
				</div>
			</form>
		</Dialog>
	)
}
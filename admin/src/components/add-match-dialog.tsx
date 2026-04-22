import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'

import { useAuth } from '@/components/use-auth'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { pickLocalizedPreview } from '@/lib/localized-fields'
import { cn } from '@/lib/utils'
import type { AdminTeamItem, AdminVenueItem, MatchItem } from '@/types'

const UNKNOWN_TEAM_ID = '-1'

type AddMatchDialogProps = {
	sportSlug: string
	leagueSlug: string
	seasonSlug: string
	match?: MatchItem | null
	open: boolean
	onOpenChange: (open: boolean) => void
	onSaved: () => Promise<void>
}

type MatchFormState = {
	homeTeamID: string
	awayTeamID: string
	round: string
	startsAt: string
	status: string
	venueID: string
	venueSearch: string
}

const emptyMatchForm: MatchFormState = {
	homeTeamID: UNKNOWN_TEAM_ID,
	awayTeamID: UNKNOWN_TEAM_ID,
	round: '',
	startsAt: '',
	status: 'scheduled',
	venueID: '',
	venueSearch: '',
}

function toDateTimeLocalValue(value: string) {
	if (!value) {
		return ''
	}
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) {
		return ''
	}
	return `${formatLocalDate(date)}T${formatLocalTime(date)}`
}

function formatLocalDate(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatLocalTime(date: Date) {
	return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function getDatePart(value: string) {
	return value.split('T')[0] || ''
}

function getTimePart(value: string) {
	return value.includes('T') ? value.slice(11, 16) : ''
}

function parseLocalDateTime(value: string) {
	if (!value) {
		return undefined
	}
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) {
		return undefined
	}
	return date
}

function buildMatchForm(match?: MatchItem | null): MatchFormState {
	if (!match) {
		return emptyMatchForm
	}
	return {
		homeTeamID: String(match.homeTeamID ?? UNKNOWN_TEAM_ID),
		awayTeamID: String(match.awayTeamID ?? UNKNOWN_TEAM_ID),
		round: match.round ?? '',
		startsAt: toDateTimeLocalValue(match.startsAt),
		status: match.status || 'scheduled',
		venueID: match.venueId ? String(match.venueId) : '',
		venueSearch: match.venue ?? '',
	}
}

export function AddMatchDialog({ sportSlug, leagueSlug, seasonSlug, match = null, open, onOpenChange, onSaved }: AddMatchDialogProps) {
	const { token } = useAuth()
	const [teams, setTeams] = useState<AdminTeamItem[]>([])
	const [venues, setVenues] = useState<AdminVenueItem[]>([])
	const [loading, setLoading] = useState(false)
	const [pending, setPending] = useState(false)
	const [calendarOpen, setCalendarOpen] = useState(false)
	const [form, setForm] = useState<MatchFormState>(emptyMatchForm)
	const [error, setError] = useState<string | null>(null)
	const isEditing = match !== null
	const selectedKickoffDate = parseLocalDateTime(form.startsAt)

	useEffect(() => {
		if (!open) {
			setForm(emptyMatchForm)
			setCalendarOpen(false)
			setError(null)
			return
		}
		setForm(buildMatchForm(match))
		setVenues((current) => current)
		setError(null)
	}, [match, open])

	useEffect(() => {
		if (!open || !token) {
			return
		}
		let active = true
		setLoading(true)
		setError(null)
		void Promise.all([
			api.listAdminTeams(token, sportSlug, leagueSlug),
			api.listAdminVenues(token),
		])
			.then(([teamsResponse, venuesResponse]) => {
				if (!active) {
					return
				}
				setTeams(teamsResponse.items)
				setVenues(venuesResponse.items)
			})
			.catch((caught) => {
				if (!active) {
					return
				}
				setTeams([])
				setVenues([])
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

	const filteredVenueOptions = useMemo(() => {
		const query = form.venueSearch.trim().toLowerCase()
		if (!query) {
			return venues
		}
		return venues.filter((venue) => {
			const haystack = [venue.id.toString(), ...Object.values(venue.name), ...Object.values(venue.city), ...Object.values(venue.country)].join(' ').toLowerCase()
			return haystack.includes(query)
		})
	}, [form.venueSearch, venues])

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!token) {
			return
		}
		const startsAt = parseLocalDateTime(form.startsAt)
		if (!startsAt) {
			setError('Kickoff must be a valid date and time')
			return
		}
		setPending(true)
		setError(null)
		try {
			const payload = {
				sportSlug,
				leagueSlug,
				seasonSlug,
				homeTeamID: Number(form.homeTeamID),
				awayTeamID: Number(form.awayTeamID),
				round: { en: form.round },
				startsAt: startsAt.toISOString(),
				status: form.status,
				venueId: form.venueID ? Number(form.venueID) : null,
			}
			if (match) {
				await api.updateMatch(token, match.id, payload)
			} else {
				await api.createMatch(token, payload)
			}
			await onSaved()
			onOpenChange(false)
			setForm(emptyMatchForm)
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : isEditing ? 'update failed' : 'create failed')
		} finally {
			setPending(false)
		}
	}

	function handleDateSelect(date: Date | undefined) {
		if (!date) {
			return
		}
		const timePart = getTimePart(form.startsAt) || '12:00'
		setForm((current) => ({
			...current,
			startsAt: `${formatLocalDate(date)}T${timePart}`,
		}))
		setCalendarOpen(false)
	}

	function handleTimeChange(value: string) {
		const datePart = getDatePart(form.startsAt)
		setForm((current) => ({
			...current,
			startsAt: datePart ? `${datePart}T${value}` : current.startsAt,
		}))
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange} title={isEditing ? 'Edit match' : 'Add match'} description={isEditing ? 'Update a manually managed fixture. Synced matches remain read-only.' : 'Create a single manual fixture for this season. Unknown-team slots use the shared sentinel value instead of fake teams.'} contentClassName="max-w-2xl">
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
					<div>
						<Label htmlFor="match-starts-at-date">Date</Label>
						<div className="mt-2">
							<Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
								<PopoverTrigger asChild>
									<Button id="match-starts-at-date" type="button" variant="outline" className={cn('w-full justify-start px-3 text-left font-normal', !selectedKickoffDate && 'text-muted-foreground')}>
										<CalendarIcon data-icon="inline-start" />
										{selectedKickoffDate ? format(selectedKickoffDate, 'PPP') : 'Select date'}
									</Button>
								</PopoverTrigger>
								<PopoverContent align="start" className="w-auto p-0">
									<Calendar
										mode="single"
										selected={selectedKickoffDate}
										onSelect={handleDateSelect}
										captionLayout="dropdown"
										initialFocus
										timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
									/>
								</PopoverContent>
							</Popover>
						</div>
					</div>
					<div>
						<Label htmlFor="match-starts-at-time">Time</Label>
						<div className="mt-2">
							<Input id="match-starts-at-time" required type="time" step="60" value={getTimePart(form.startsAt)} disabled={!getDatePart(form.startsAt)} onChange={(event) => handleTimeChange(event.target.value)} />
						</div>
					</div>
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
				</div>
				<div className="grid gap-4 md:grid-cols-3">
					<div className="md:col-span-3 space-y-3">
						<div>
							<Label htmlFor="match-venue-search">Venue search</Label>
							<Input id="match-venue-search" placeholder="Search venue by id, name, city, or country" value={form.venueSearch} onChange={(event) => setForm((current) => ({ ...current, venueSearch: event.target.value }))} />
						</div>
						<div>
							<Label htmlFor="match-venue-id">Venue</Label>
							<Select value={form.venueID || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, venueID: value === '__none__' ? '' : value }))}>
								<SelectTrigger id="match-venue-id">
									<SelectValue placeholder="No venue selected" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectItem value="__none__">No venue</SelectItem>
										{filteredVenueOptions.map((venue) => (
											<SelectItem key={venue.id} value={String(venue.id)}>
												{venue.id} · {pickLocalizedPreview(venue.name)} · {[pickLocalizedPreview(venue.city), pickLocalizedPreview(venue.country)].filter((value) => value !== '-').join(', ')}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>
				{error ? <p className="text-sm text-danger">{error}</p> : null}
				<div className="flex justify-end gap-3">
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancel</Button>
					<Button disabled={pending || loading} type="submit">{pending ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save changes' : 'Create match')}</Button>
				</div>
			</form>
		</Dialog>
	)
}

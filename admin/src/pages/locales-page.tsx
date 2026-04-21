import { useCallback, useMemo, useState } from 'react'

import { CatalogDataTable } from '@/components/catalog-data-table'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { useAdminLocales } from '@/components/admin-locales-provider'
import { useAuth } from '@/components/use-auth'
import { useToast } from '@/components/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import type { AdminLocaleItem } from '@/types'

type LocaleDialogMode = 'create' | 'edit'

type LocaleDialogState = {
	mode: LocaleDialogMode
	locale: AdminLocaleItem | null
}

export function LocalesPage() {
	const { token } = useAuth()
	const { showToast } = useToast()
	const { locales, loading, error, refresh } = useAdminLocales()
	const [dialogState, setDialogState] = useState<LocaleDialogState | null>(null)
	const [deleteTarget, setDeleteTarget] = useState<AdminLocaleItem | null>(null)
	const [pending, setPending] = useState(false)
	const [formError, setFormError] = useState<string | null>(null)
	const [deleteError, setDeleteError] = useState<string | null>(null)
	const [code, setCode] = useState('')
	const [label, setLabel] = useState('')

	const sortedLocales = useMemo(() => [...locales].sort((left, right) => left.code.localeCompare(right.code)), [locales])

	const openCreate = useCallback(() => {
		setDialogState({ mode: 'create', locale: null })
		setCode('')
		setLabel('')
		setFormError(null)
	}, [])

	const openEdit = useCallback((locale: AdminLocaleItem) => {
		setDialogState({ mode: 'edit', locale })
		setCode(locale.code)
		setLabel(locale.label)
		setFormError(null)
	}, [])

	async function handleSaveLocale(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!token || !dialogState) {
			return
		}
		setPending(true)
		setFormError(null)
		try {
			if (dialogState.mode === 'create') {
				await api.createAdminLocale(token, { code, label })
				showToast({ title: 'Locale created', description: `${code} is now available in admin forms.`, tone: 'success' })
			} else {
				await api.updateAdminLocale(token, code, { label })
				showToast({ title: 'Locale updated', description: `${code} label was saved.`, tone: 'success' })
			}
			await refresh()
			setDialogState(null)
		} catch (caught) {
			setFormError(caught instanceof Error ? caught.message : 'save failed')
		} finally {
			setPending(false)
		}
	}

	async function handleDeleteLocale() {
		if (!token || !deleteTarget) {
			return
		}
		setPending(true)
		setDeleteError(null)
		try {
			await api.deleteAdminLocale(token, deleteTarget.code)
			await refresh()
			showToast({ title: 'Locale deleted', description: `${deleteTarget.code} was removed from admin locale options.`, tone: 'success' })
			setDeleteTarget(null)
		} catch (caught) {
			setDeleteError(caught instanceof Error ? caught.message : 'delete failed')
		} finally {
			setPending(false)
		}
	}

	return (
		<div className="space-y-6">
			<Card className="demo-panel">
				<CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
					<div>
						<CardTitle>Locale settings</CardTitle>
						<CardDescription>Manage the locale options used by admin multi-language forms.</CardDescription>
					</div>
					<Button onClick={openCreate} type="button">Add locale</Button>
				</CardHeader>
				<CardContent>
					{loading ? <p className="mb-4 text-sm text-muted">Loading locale settings...</p> : null}
					{error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
					<CatalogDataTable
						columns={[
							{ id: 'code', header: 'Code', cell: (locale) => <span className="font-mono text-xs">{locale.code}</span>, cellClassName: 'w-32' },
							{ id: 'label', header: 'Label', cell: (locale) => locale.label },
						]}
						rows={sortedLocales}
						getRowId={(locale) => locale.code}
						getSearchText={(locale) => `${locale.code} ${locale.label}`}
						searchPlaceholder="Filter locales..."
						emptyMessage="No locales configured."
						renderRowActions={(locale) => (
							<>
								<DropdownMenuItem onSelect={() => openEdit(locale)}>Edit</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive focus:text-destructive"
									onSelect={() => {
										setDeleteError(null)
										setDeleteTarget(locale)
									}}
								>
									Delete
								</DropdownMenuItem>
							</>
						)}
					/>
				</CardContent>
			</Card>
			<Dialog
				open={dialogState !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDialogState(null)
						setFormError(null)
					}
				}}
				title={dialogState?.mode === 'edit' ? 'Edit locale' : 'Create locale'}
				description={dialogState?.mode === 'edit' ? 'Update the display label used in admin locale selectors.' : 'Add a new locale option for admin multi-language forms.'}
			>
				<form className="space-y-5" onSubmit={handleSaveLocale}>
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<Label htmlFor="admin-locale-code">Code</Label>
							<Input
								disabled={dialogState?.mode === 'edit'}
								id="admin-locale-code"
								placeholder="en"
								required
								value={code}
								onChange={(event) => setCode(event.target.value)}
							/>
						</div>
						<div>
							<Label htmlFor="admin-locale-label">Label</Label>
							<Input
								id="admin-locale-label"
								placeholder="English"
								required
								value={label}
								onChange={(event) => setLabel(event.target.value)}
							/>
						</div>
					</div>
					{formError ? <p className="text-sm text-danger">{formError}</p> : null}
					<div className="flex justify-end gap-3">
						<Button onClick={() => setDialogState(null)} type="button" variant="outline">Cancel</Button>
						<Button disabled={pending} type="submit">{pending ? 'Saving...' : dialogState?.mode === 'edit' ? 'Save locale' : 'Create locale'}</Button>
					</div>
				</form>
			</Dialog>
			<ConfirmActionDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteTarget(null)
						setDeleteError(null)
					}
				}}
				title="Delete locale"
				description={deleteTarget ? `Delete ${deleteTarget.code} from admin locale options? Existing admin forms will no longer offer it for new entries.` : 'Delete this locale?'}
				confirmLabel="Delete locale"
				pendingLabel="Deleting..."
				onConfirm={handleDeleteLocale}
				pending={pending}
				error={deleteError}
			/>
		</div>
	)
}

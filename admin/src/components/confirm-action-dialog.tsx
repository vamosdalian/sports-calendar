import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

type ConfirmActionDialogProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: string
	confirmLabel: string
	pendingLabel: string
	onConfirm: () => Promise<void> | void
	pending?: boolean
	error?: string | null
	variant?: 'default' | 'danger'
}

export function ConfirmActionDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	pendingLabel,
	onConfirm,
	pending = false,
	error,
	variant = 'danger',
}: ConfirmActionDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
			<div className="space-y-5">
				<div className="rounded-2xl border border-line/70 bg-shell/55 px-4 py-4 text-sm text-muted">
					This action will update the local catalog immediately.
				</div>
				{error ? <p className="text-sm text-danger">{error}</p> : null}
				<div className="flex justify-end gap-3">
					<Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancel</Button>
					<Button disabled={pending} onClick={() => void onConfirm()} type="button" variant={variant}>{pending ? pendingLabel : confirmLabel}</Button>
				</div>
			</div>
		</Dialog>
	)
}
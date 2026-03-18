import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'

type DialogProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description?: string
	children: React.ReactNode
	widthClassName?: string
}

export function Dialog({ open, onOpenChange, title, description, children, widthClassName = 'max-w-3xl' }: DialogProps) {
	useEffect(() => {
		if (!open) {
			return undefined
		}
		const originalOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => {
			document.body.style.overflow = originalOverflow
		}
	}, [open])

	useEffect(() => {
		if (!open) {
			return undefined
		}
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				onOpenChange(false)
			}
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [onOpenChange, open])

	if (!open) {
		return null
	}

	return createPortal(
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
			<div className={`relative z-10 max-h-[90vh] w-full overflow-hidden rounded-[28px] border border-line/80 bg-panel shadow-panel ${widthClassName}`}>
				<div className="flex items-start justify-between gap-4 border-b border-line/70 px-6 py-5">
					<div>
						<h2 className="text-xl font-semibold text-ink">{title}</h2>
						{description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
					</div>
					<Button onClick={() => onOpenChange(false)} size="sm" type="button" variant="ghost">Close</Button>
				</div>
				<div className="max-h-[calc(90vh-92px)] overflow-y-auto px-6 py-5">{children}</div>
			</div>
		</div>,
		document.body,
	)
}
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, CircleAlert, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ToastContext, type ToastInput } from '@/components/ui/toast-context'

type ToastItem = {
	id: number
	title: string
	description?: string
	tone: ToastInput['tone']
}

export function ToastProvider({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<ToastItem[]>([])

	const dismissToast = useCallback((id: number) => {
		setItems((current) => current.filter((item) => item.id !== id))
	}, [])

	const showToast = useCallback((toast: ToastInput) => {
		const id = Date.now() + Math.floor(Math.random() * 1000)
		setItems((current) => [...current, { ...toast, id }])
		window.setTimeout(() => {
			dismissToast(id)
		}, 3200)
	}, [dismissToast])

	const value = useMemo(() => ({ showToast }), [showToast])

	return (
		<ToastContext.Provider value={value}>
			{children}
			<div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
				{items.map((item) => (
					<div
						key={item.id}
						className={item.tone === 'success'
							? 'pointer-events-auto rounded-3xl border border-emerald-200/80 bg-white/95 px-4 py-4 shadow-[0_20px_50px_rgba(16,33,50,0.14)] backdrop-blur'
							: 'pointer-events-auto rounded-3xl border border-rose-200/80 bg-white/95 px-4 py-4 shadow-[0_20px_50px_rgba(16,33,50,0.14)] backdrop-blur'}
					>
						<div className="flex items-start gap-3">
							<div className={item.tone === 'success' ? 'mt-0.5 text-emerald-600' : 'mt-0.5 text-rose-600'}>
								{item.tone === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <CircleAlert className="h-5 w-5" />}
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-semibold text-ink">{item.title}</p>
								{item.description ? <p className="mt-1 text-sm text-muted">{item.description}</p> : null}
							</div>
							<Button aria-label="Dismiss toast" className="h-8 w-8 rounded-full p-0" onClick={() => dismissToast(item.id)} type="button" variant="ghost"><X className="h-4 w-4" /></Button>
						</div>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	)
}
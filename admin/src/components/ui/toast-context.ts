import { createContext } from 'react'

export type ToastTone = 'success' | 'error'

export type ToastInput = {
	title: string
	description?: string
	tone: ToastTone
}

export type ToastContextValue = {
	showToast: (toast: ToastInput) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
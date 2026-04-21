import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/components/use-auth'
import { api } from '@/lib/api'
import { getPreferredLocaleCode } from '@/lib/localized-fields'
import type { AdminLocaleItem } from '@/types'

type AdminLocalesContextValue = {
	locales: AdminLocaleItem[]
	loading: boolean
	error: string | null
	refresh: () => Promise<void>
	preferredLocaleCode: string
}

const AdminLocalesContext = createContext<AdminLocalesContextValue | null>(null)

export function AdminLocalesProvider({ children }: { children: React.ReactNode }) {
	const { token } = useAuth()
	const [locales, setLocales] = useState<AdminLocaleItem[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const refresh = useCallback(async () => {
		if (!token) {
			setLocales([])
			setError(null)
			return
		}
		setLoading(true)
		try {
			const response = await api.listAdminLocales(token)
			setLocales(response.items)
			setError(null)
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'load locales failed')
		} finally {
			setLoading(false)
		}
	}, [token])

	useEffect(() => {
		void refresh()
	}, [refresh])

	const value = useMemo<AdminLocalesContextValue>(() => ({
		locales,
		loading,
		error,
		refresh,
		preferredLocaleCode: getPreferredLocaleCode(locales),
	}), [error, loading, locales, refresh])

	return <AdminLocalesContext.Provider value={value}>{children}</AdminLocalesContext.Provider>
}

export function useAdminLocales() {
	const context = useContext(AdminLocalesContext)
	if (!context) {
		throw new Error('useAdminLocales must be used within AdminLocalesProvider')
	}
	return context
}

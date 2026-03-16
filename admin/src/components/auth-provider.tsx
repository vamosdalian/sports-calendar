import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react'

import { api } from '@/lib/api'
import { isTokenExpiringSoon, parseToken } from '@/lib/token'
import type { AuthTokenResponse } from '@/types'

type AuthContextValue = {
	token: string | null
	email: string | null
	ready: boolean
	login: (email: string, password: string) => Promise<void>
	register: (email: string, password: string) => Promise<void>
	logout: () => void
	refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const STORAGE_KEY = 'sports-calendar-admin-session'

type StoredSession = { token: string; email: string }

function readStoredSession(): StoredSession | null {
	const raw = window.localStorage.getItem(STORAGE_KEY)
	if (!raw) {
		return null
	}
	try {
		return JSON.parse(raw) as StoredSession
	} catch {
		window.localStorage.removeItem(STORAGE_KEY)
		return null
	}
}

function writeStoredSession(session: StoredSession | null) {
	if (!session) {
		window.localStorage.removeItem(STORAGE_KEY)
		return
	}
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [token, setToken] = useState<string | null>(null)
	const [email, setEmail] = useState<string | null>(null)
	const [ready, setReady] = useState(false)
	const refreshTimerRef = useRef<number | null>(null)

	const clearRefreshTimer = useCallback(() => {
		if (refreshTimerRef.current !== null) {
			window.clearInterval(refreshTimerRef.current)
			refreshTimerRef.current = null
		}
	}, [])

	const applyToken = useCallback((payload: AuthTokenResponse) => {
		setToken(payload.token)
		setEmail(payload.email)
		writeStoredSession({ token: payload.token, email: payload.email })
	}, [])

	const logout = useCallback(() => {
		clearRefreshTimer()
		setToken(null)
		setEmail(null)
		writeStoredSession(null)
	}, [clearRefreshTimer])

	const refresh = useCallback(async () => {
		const currentToken = token ?? readStoredSession()?.token
		if (!currentToken) {
			throw new Error('no token available')
		}
		const payload = await api.refresh(currentToken)
		applyToken(payload)
	}, [applyToken, token])

	const login = useCallback(async (userEmail: string, password: string) => {
		const payload = await api.login(userEmail, password)
		applyToken(payload)
	}, [applyToken])

	const register = useCallback(async (userEmail: string, password: string) => {
		await api.registerAdmin(userEmail, password)
	}, [])

	useEffect(() => {
		const session = readStoredSession()
		if (session?.token) {
			const parsed = parseToken(session.token)
			if (parsed && parsed.exp > Math.floor(Date.now() / 1000)) {
				setToken(session.token)
				setEmail(session.email)
			} else {
				writeStoredSession(null)
			}
		}
		setReady(true)
	}, [])

	useEffect(() => {
		clearRefreshTimer()
		if (!token) {
			return
		}
		refreshTimerRef.current = window.setInterval(() => {
			if (!token || !isTokenExpiringSoon(token, 180)) {
				return
			}
			void refresh().catch(() => logout())
		}, 60_000)
		return clearRefreshTimer
	}, [clearRefreshTimer, logout, refresh, token])

	const value = useMemo(() => ({ token, email, ready, login, register, logout, refresh }), [token, email, ready, login, register, logout, refresh])

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
	const context = useContext(AuthContext)
	if (!context) {
		throw new Error('useAuth must be used within AuthProvider')
	}
	return context
}
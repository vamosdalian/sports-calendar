import { createContext } from 'react'

export type AuthContextValue = {
	token: string | null
	email: string | null
	ready: boolean
	login: (email: string, password: string) => Promise<void>
	register: (email: string, password: string) => Promise<void>
	logout: () => void
	refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
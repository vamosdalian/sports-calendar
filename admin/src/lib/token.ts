type TokenPayload = {
	email: string
	exp: number
}

export function parseToken(token: string): TokenPayload | null {
	const parts = token.split('.')
	if (parts.length !== 2) {
		return null
	}
	try {
		const normalized = parts[0].replace(/-/g, '+').replace(/_/g, '/')
		const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4)
		const raw = atob(padded)
		const payload = JSON.parse(raw) as TokenPayload
		if (!payload.email || !payload.exp) {
			return null
		}
		return payload
	} catch {
		return null
	}
}

export function isTokenExpiringSoon(token: string, bufferSeconds = 180) {
	const payload = parseToken(token)
	if (!payload) {
		return true
	}
	return payload.exp - Math.floor(Date.now() / 1000) <= bufferSeconds
}
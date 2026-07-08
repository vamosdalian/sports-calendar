export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8080'

// The crawler (sports-spider) is reached through the Go backend's authenticated
// proxy at `${API_BASE_URL}/api/spider/*` (see lib/spider-api.ts), so it needs
// no separate base URL of its own.
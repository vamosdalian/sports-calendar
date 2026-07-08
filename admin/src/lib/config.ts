export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8080'

// Base URL of the sports-spider (Transfermarkt crawler) FastAPI backend. The
// admin "Crawler" page calls it cross-origin. Defaults to the local compose
// stack's host port (127.0.0.1:8001); set VITE_SPIDER_API_BASE_URL at build
// time for online deploys (e.g. https://spider-api.sports-calendar.com).
export const SPIDER_API_BASE_URL =
	import.meta.env.VITE_SPIDER_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8001'
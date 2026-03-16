import type { LocalizedText } from '@/types'

export type LocalizedFieldEntry = {
	locale: string
	value: string
}

export function entriesToLocalizedText(entries: LocalizedFieldEntry[]): LocalizedText {
	return entries.reduce<LocalizedText>((accumulator, entry) => {
		const locale = entry.locale.trim()
		const value = entry.value.trim()
		if (!locale || !value) {
			return accumulator
		}
		accumulator[locale] = value
		return accumulator
	}, {})
}

export function pickLocalizedPreview(value: LocalizedText | undefined) {
	if (!value) {
		return '-'
	}
	if (value.en) {
		return value.en
	}
	const firstValue = Object.values(value).find((item) => item.trim() !== '')
	return firstValue || '-'
}
import { toast } from 'sonner'

import type { ToastInput } from '@/components/ui/toast-context'

export function useToast() {
	function showToast({ title, description, tone }: ToastInput) {
		if (tone === 'success') {
			toast.success(title, { description })
			return
		}

		toast.error(title, { description })
	}

	return { showToast }
}
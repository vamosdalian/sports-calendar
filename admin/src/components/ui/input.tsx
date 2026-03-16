import * as React from 'react'

import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
	{ className, ...props },
	ref,
) {
	return <input ref={ref} className={cn('h-11 w-full rounded-2xl border border-line bg-white px-4 text-sm text-ink shadow-sm outline-none transition placeholder:text-muted focus:border-header focus:ring-2 focus:ring-header/15', className)} {...props} />
})
import * as React from 'react'

import { cn } from '@/lib/utils'

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, ...props }, ref) {
	return (
		<select
			className={cn('flex h-11 w-full rounded-2xl border border-line bg-white px-4 text-sm text-ink shadow-sm outline-none transition focus:border-header/40 focus:ring-2 focus:ring-header/20 disabled:cursor-not-allowed disabled:opacity-60', className)}
			ref={ref}
			{...props}
		/>
	)
})
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
	'inline-flex items-center justify-center rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-header/30 disabled:pointer-events-none disabled:opacity-50',
	{
		variants: {
			variant: {
				default: 'bg-header px-4 py-2.5 text-white hover:bg-header/90',
				outline: 'border border-line bg-white px-4 py-2.5 text-ink hover:bg-shell',
				ghost: 'px-3 py-2 text-muted hover:bg-white/80',
				danger: 'bg-danger px-4 py-2.5 text-white hover:bg-danger/90',
			},
			size: {
				default: 'h-11',
				sm: 'h-9 px-3',
				lg: 'h-12 px-5 text-base',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
)

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & {
	asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{ className, variant, size, asChild = false, ...props },
	ref,
) {
	const Comp = asChild ? Slot : 'button'
	return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
})
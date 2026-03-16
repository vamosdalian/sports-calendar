import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function DashboardPage() {
	return (
		<>
			<Card className="overflow-hidden bg-header text-white">
				<CardContent className="grid gap-6 px-8 py-8 md:grid-cols-[1.4fr_0.6fr]">
					<div>
						<Badge className="bg-white/15 text-white">Admin overview</Badge>
						<h1 className="mt-4 font-display text-4xl font-bold tracking-tight">Catalog control with direct backend API access.</h1>
						<p className="mt-4 max-w-2xl text-white/75">The admin app talks straight to the Go backend. Start with sports, attach leagues with their TheSportsDB ids, then create seasons and inspect fixture data.</p>
					</div>
					<div className="flex items-end justify-start md:justify-end">
						<Button asChild className="bg-white text-header hover:bg-white/90">
							<Link to="/sports">Open catalog management</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
			<div className="grid gap-6 lg:grid-cols-3">
				<Card><CardHeader><CardTitle>1. Create sports</CardTitle></CardHeader></Card>
				<Card><CardHeader><CardTitle>2. Attach leagues</CardTitle></CardHeader></Card>
				<Card><CardHeader><CardTitle>3. Shape seasons</CardTitle></CardHeader></Card>
			</div>
		</>
	)
}
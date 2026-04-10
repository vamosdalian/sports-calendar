import { Outlet } from 'react-router-dom'

import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export function AdminShell() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<SiteHeader />
				<div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	)
}
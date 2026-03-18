import { useMemo, useState, type ReactNode } from 'react'
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronsLeftIcon,
	ChevronsRightIcon,
	MoreVerticalIcon,
	SearchIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

type CatalogColumn<T> = {
	id: string
	header: ReactNode
	cell: (row: T) => ReactNode
	headerClassName?: string
	cellClassName?: string
}

type CatalogDataTableProps<T> = {
	columns: CatalogColumn<T>[]
	rows: T[]
	getRowId: (row: T) => string
	getSearchText?: (row: T) => string
	searchPlaceholder?: string
	emptyMessage: string
	renderRowActions?: (row: T) => ReactNode
	rowClassName?: (row: T) => string | undefined
	onRowClick?: (row: T) => void
	pageSizeOptions?: number[]
	initialPageSize?: number
	toolbarSlot?: ReactNode
}

export function CatalogDataTable<T>({
	columns,
	rows,
	getRowId,
	getSearchText,
	searchPlaceholder = 'Filter rows...',
	emptyMessage,
	renderRowActions,
	rowClassName,
	onRowClick,
	pageSizeOptions = [10, 20, 30, 40, 50],
	initialPageSize = 10,
	toolbarSlot,
}: CatalogDataTableProps<T>) {
	const [query, setQuery] = useState('')
	const [pageIndex, setPageIndex] = useState(0)
	const [pageSize, setPageSize] = useState(initialPageSize)

	const filteredRows = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase()
		if (!normalizedQuery || !getSearchText) {
			return rows
		}
		return rows.filter((row) => getSearchText(row).toLowerCase().includes(normalizedQuery))
	}, [getSearchText, query, rows])

	const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
	const currentPage = Math.min(pageIndex, pageCount - 1)
	const pageRows = useMemo(() => {
		const start = currentPage * pageSize
		return filteredRows.slice(start, start + pageSize)
	}, [currentPage, filteredRows, pageSize])

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 px-0 lg:flex-row lg:items-center lg:justify-between">
				<div className="relative w-full max-w-sm">
					<SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={searchPlaceholder}
						className="h-9 pl-9"
					/>
				</div>
				<div className="flex items-center justify-between gap-2 lg:justify-end">
					<Badge variant="outline" className="px-2 text-muted-foreground">
						{filteredRows.length} items
					</Badge>
					{toolbarSlot}
				</div>
			</div>
			<div className="overflow-hidden rounded-lg border bg-background">
				<Table>
					<TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur [&_tr]:border-b">
						<TableRow className="hover:bg-transparent">
							{columns.map((column) => (
								<TableHead key={column.id} className={column.headerClassName}>
									{column.header}
								</TableHead>
							))}
							{renderRowActions ? <TableHead className="w-12 text-right"> </TableHead> : null}
						</TableRow>
					</TableHeader>
					<TableBody>
						{pageRows.length > 0 ? (
							pageRows.map((row) => (
								<TableRow
									key={getRowId(row)}
									onClick={onRowClick ? () => onRowClick(row) : undefined}
									className={cn(onRowClick ? 'cursor-pointer' : undefined, rowClassName?.(row))}
								>
									{columns.map((column) => (
										<TableCell key={column.id} className={column.cellClassName}>
											{column.cell(row)}
										</TableCell>
									))}
									{renderRowActions ? (
										<TableCell className="w-12" onClick={(event) => event.stopPropagation()}>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="ml-auto flex size-8 text-muted-foreground data-[state=open]:bg-muted"
													>
														<MoreVerticalIcon />
														<span className="sr-only">Open row actions</span>
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" className="w-40">
													{renderRowActions(row)}
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									) : null}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columns.length + (renderRowActions ? 1 : 0)} className="h-24 text-center text-muted-foreground">
									{emptyMessage}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex flex-col gap-3 px-0 lg:flex-row lg:items-center lg:justify-between">
				<div className="text-sm text-muted-foreground">
					Showing {pageRows.length === 0 ? 0 : currentPage * pageSize + 1}-{currentPage * pageSize + pageRows.length} of {filteredRows.length}
				</div>
				<div className="flex w-full items-center gap-3 lg:w-auto lg:gap-8">
					<div className="hidden items-center gap-2 lg:flex">
						<span className="text-sm font-medium">Rows per page</span>
						<Select
							value={`${pageSize}`}
							onValueChange={(value) => {
								setPageSize(Number(value))
								setPageIndex(0)
							}}
						>
							<SelectTrigger className="w-20">
								<SelectValue placeholder={pageSize} />
							</SelectTrigger>
							<SelectContent side="top">
								{pageSizeOptions.map((option) => (
									<SelectItem key={option} value={`${option}`}>
										{option}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex w-fit items-center justify-center text-sm font-medium">
						Page {currentPage + 1} of {pageCount}
					</div>
					<div className="ml-auto flex items-center gap-2 lg:ml-0">
						<Button
							variant="outline"
							className="hidden h-8 w-8 p-0 lg:flex"
							onClick={() => setPageIndex(0)}
							disabled={currentPage === 0}
						>
							<span className="sr-only">Go to first page</span>
							<ChevronsLeftIcon />
						</Button>
						<Button
							variant="outline"
							size="icon"
							className="size-8"
							onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
							disabled={currentPage === 0}
						>
							<span className="sr-only">Go to previous page</span>
							<ChevronLeftIcon />
						</Button>
						<Button
							variant="outline"
							size="icon"
							className="size-8"
							onClick={() => setPageIndex((value) => Math.min(pageCount - 1, value + 1))}
							disabled={currentPage >= pageCount - 1}
						>
							<span className="sr-only">Go to next page</span>
							<ChevronRightIcon />
						</Button>
						<Button
							variant="outline"
							size="icon"
							className="hidden size-8 lg:flex"
							onClick={() => setPageIndex(pageCount - 1)}
							disabled={currentPage >= pageCount - 1}
						>
							<span className="sr-only">Go to last page</span>
							<ChevronsRightIcon />
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
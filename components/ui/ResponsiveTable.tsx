'use client'

import React from 'react'

// ============================================================================
// Types
// ============================================================================

export type ColumnPriority = 'primary' | 'secondary' | 'tertiary'

export interface Column<T> {
  /** Unique key to access data, can be nested like 'user.name' */
  key: keyof T | string
  /** Header text displayed in table */
  header: string
  /** Custom render function for cell content */
  render?: (item: T, index: number) => React.ReactNode
  /** 
   * Column visibility priority:
   * - primary: Always visible (both desktop and mobile)
   * - secondary: Visible on md+ screens, hidden on mobile table but shown in card
   * - tertiary: Only visible on lg+ screens
   */
  priority?: ColumnPriority
  /** Text alignment */
  align?: 'left' | 'center' | 'right'
  /** Additional className for the column */
  className?: string
  /** Label shown in mobile card view (defaults to header) */
  mobileLabel?: string
  /** Minimum width for the column */
  minWidth?: string
  /** Whether the column is sortable */
  sortable?: boolean
}

export interface ResponsiveTableProps<T> {
  /** Array of data items to display */
  data: T[]
  /** Column definitions */
  columns: Column<T>[]
  /** Unique key field in data items */
  keyField: keyof T
  /** Loading state */
  loading?: boolean
  /** Message shown when no data */
  emptyMessage?: React.ReactNode
  /** Message shown while loading */
  loadingMessage?: string
  /** Callback when row is clicked */
  onRowClick?: ((item: T) => void) | undefined
  /** Render action buttons for each row */
  renderActions?: ((item: T) => React.ReactNode) | undefined
  /** Custom mobile card renderer (optional, uses default if not provided) */
  renderMobileCard?: ((item: T, columns: Column<T>[]) => React.ReactNode) | undefined
  /** Additional className for the wrapper */
  className?: string
  /** Show row numbers */
  showRowNumbers?: boolean
  /** Striped rows */
  striped?: boolean
  /** Current sort column key */
  sortColumn?: string
  /** Current sort direction */
  sortDirection?: 'asc' | 'desc'
  /** Callback when sorting changes */
  onSort?: (columnKey: string, direction: 'asc' | 'desc') => void
  /** Current page number */
  page?: number
  /** Total number of pages */
  totalPages?: number
  /** Callback when page changes */
  onPageChange?: (page: number) => void
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Safely render a value that might be an object
 */
function safeRender(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return '-'
  }
  if (React.isValidElement(value)) {
    return value
  }
  if (typeof value === 'object') {
    // If it has a 'name' property, use it (common pattern)
    if ('name' in value) {
      return String((value as { name: unknown }).name)
    }
    // Otherwise stringify
    return JSON.stringify(value)
  }
  return value as React.ReactNode
}

/**
 * Get nested value from object using dot notation
 * e.g. getNestedValue(obj, 'user.name') returns obj.user.name
 */
function getNestedValue<T>(obj: T, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, obj)
}

/**
 * Get alignment class based on alignment prop
 */
function getAlignmentClass(align?: 'left' | 'center' | 'right'): string {
  switch (align) {
    case 'center':
      return 'text-center'
    case 'right':
      return 'text-right'
    default:
      return 'text-left'
  }
}

/**
 * Get priority visibility classes
 */
function getPriorityClasses(priority?: ColumnPriority): string {
  switch (priority) {
    case 'primary':
      return '' // Always visible
    case 'secondary':
      return 'hidden md:table-cell'
    case 'tertiary':
      return 'hidden lg:table-cell'
    default:
      return '' // Default to always visible
  }
}

// ============================================================================
// Sub Components
// ============================================================================

interface MobileCardProps<T> {
  item: T
  columns: Column<T>[]
  index: number
  onRowClick?: ((item: T) => void) | undefined
  renderActions?: ((item: T) => React.ReactNode) | undefined
}

function DefaultMobileCard<T>({
  item,
  columns,
  index,
  onRowClick,
  renderActions
}: MobileCardProps<T>) {
  // Get primary columns for the card header
  const primaryColumns = columns.filter(col => col.priority === 'primary' || !col.priority)
  const otherColumns = columns.filter(col => col.priority === 'secondary' || col.priority === 'tertiary')

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow ${onRowClick ? 'cursor-pointer' : ''}`}
      onClick={() => onRowClick?.(item)}
    >
      {/* Primary Info - Header Section */}
      <div className="mb-3">
        {primaryColumns.slice(0, 2).map((column, colIndex) => {
          const value = column.render
            ? column.render(item, index)
            : getNestedValue(item, String(column.key))

            return (
              <div key={String(column.key)} className={colIndex === 0 ? 'font-semibold text-gray-900 dark:text-white' : 'text-sm text-gray-600 dark:text-gray-400'}>
                {safeRender(value)}
              </div>
            )
          })}
        </div>

      {/* Other Info - Grid Layout */}
      {(otherColumns.length > 0 || primaryColumns.length > 2) && (
        <div className="grid grid-cols-2 gap-2 text-sm border-t border-gray-100 dark:border-gray-700 pt-3">
          {[...primaryColumns.slice(2), ...otherColumns].map((column) => {
            const value = column.render
              ? column.render(item, index)
              : getNestedValue(item, String(column.key))

            return (
              <div key={String(column.key)} className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {column.mobileLabel || column.header}
                </span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {safeRender(value)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Actions */}
      {renderActions && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
          {renderActions(item)}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ResponsiveTable<T>({
  data,
  columns,
  keyField,
  loading = false,
  emptyMessage = 'Tidak ada data',
  loadingMessage = 'Memuat data...',
  onRowClick,
  renderActions,
  renderMobileCard,
  className = '',
  showRowNumbers = false,
  striped = false,
  sortColumn,
  sortDirection,
  onSort,
  page,
  totalPages,
  onPageChange
}: ResponsiveTableProps<T>) {
  // Ensure data is always an array
  const safeData = Array.isArray(data) ? data : []
  const totalColumns = columns.length + (showRowNumbers ? 1 : 0) + (renderActions ? 1 : 0)

  // Loading State
  if (loading) {
    return (
      <div className={`${className}`}>
        {/* Desktop Loading */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {showRowNumbers && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-12">
                    #
                  </th>
                )}
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${getAlignmentClass(column.align)} ${getPriorityClasses(column.priority)} ${column.className || ''}`}
                    style={column.minWidth ? { minWidth: column.minWidth } : undefined}
                  >
                    {column.header}
                  </th>
                ))}
                {renderActions && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Aksi
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              <tr>
                <td colSpan={totalColumns} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <span>{loadingMessage}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile Loading */}
        <div className="md:hidden p-4">
          <div className="flex flex-col items-center gap-2 py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="text-gray-500 dark:text-gray-400">{loadingMessage}</span>
          </div>
        </div>
      </div>
    )
  }

  // Empty State
  if (!safeData || safeData.length === 0) {
    return (
      <div className={`${className}`}>
        {/* Desktop Empty */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {showRowNumbers && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-12">
                    #
                  </th>
                )}
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${getAlignmentClass(column.align)} ${getPriorityClasses(column.priority)} ${column.className || ''}`}
                    style={column.minWidth ? { minWidth: column.minWidth } : undefined}
                  >
                    {column.header}
                  </th>
                ))}
                {renderActions && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Aksi
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              <tr>
                <td colSpan={totalColumns} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile Empty */}
        <div className="md:hidden p-4 text-center text-gray-500 dark:text-gray-400 py-10">
          {emptyMessage}
        </div>
      </div>
    )
  }

  // Data State
  return (
    <div className={`${className}`}>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {showRowNumbers && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-12">
                  #
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`
                    px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider 
                    ${getAlignmentClass(column.align)} ${getPriorityClasses(column.priority)} 
                    ${column.className || ''} 
                    ${column.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none' : ''}
                  `}
                  style={column.minWidth ? { minWidth: column.minWidth } : undefined}
                  onClick={() => {
                    if (column.sortable && onSort) {
                      const newDirection = sortColumn === column.key && sortDirection === 'asc' ? 'desc' : 'asc'
                      onSort(String(column.key), newDirection)
                    }
                  }}
                >
                  <div className={`flex items-center gap-1 ${column.align === 'center' ? 'justify-center' : column.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                    {column.header}
                    {column.sortable && sortColumn === column.key && (
                      <span className="text-gray-400 font-bold">
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {renderActions && (
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Aksi
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {safeData.map((item, index) => (
              <tr
                key={String(item[keyField])}
                className={`
                  ${onRowClick ? 'cursor-pointer' : ''}
                  ${striped && index % 2 === 1 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}
                  hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                `}
                onClick={() => onRowClick?.(item)}
              >
                {showRowNumbers && (
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {index + 1}
                  </td>
                )}
                {columns.map((column) => {
                  const value = column.render
                    ? column.render(item, index)
                    : getNestedValue(item, String(column.key))

                  return (
                    <td
                      key={String(column.key)}
                      className={`px-4 py-3 text-sm text-gray-900 dark:text-white ${getAlignmentClass(column.align)} ${getPriorityClasses(column.priority)} ${column.className || ''}`}
                    >
                      {safeRender(value)}
                    </td>
                  )
                })}
                {renderActions && (
                  <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {renderActions(item)}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3 p-2">
        {data.map((item, index) => (
          <React.Fragment key={String(item[keyField])}>
            {renderMobileCard ? (
              renderMobileCard(item, columns)
            ) : (
              <DefaultMobileCard
                item={item}
                columns={columns}
                index={index}
                onRowClick={onRowClick}
                renderActions={renderActions}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages && totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => onPageChange(Math.max(1, (page || 1) - 1))}
              disabled={(page || 1) <= 1}
              className="relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(Math.min(totalPages, (page || 1) + 1))}
              disabled={(page || 1) >= totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Page <span className="font-medium">{page || 1}</span> of <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => onPageChange(Math.max(1, (page || 1) - 1))}
                  disabled={(page || 1) <= 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
                {/* Simple page numbers */}
                 {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    let p = (page || 1) - 2 + i;
                    if (p < 1) p = i + 1;
                    if (p > totalPages) return null;
                    
                    return (
                        <button
                            key={p}
                            onClick={() => onPageChange(p)}
                            aria-current={p === (page || 1) ? 'page' : undefined}
                            className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                p === (page || 1)
                                    ? 'z-10 bg-indigo-600 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                                    : 'text-gray-900 dark:text-gray-200 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0'
                            }`}
                        >
                            {p}
                        </button>
                    );
                 })}
                <button
                  onClick={() => onPageChange(Math.min(totalPages, (page || 1) + 1))}
                  disabled={(page || 1) >= totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Exports
// ============================================================================

export default ResponsiveTable

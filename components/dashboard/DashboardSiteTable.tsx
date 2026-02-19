'use client'

import React from 'react'
import ResponsiveTable, { type Column } from '@/components/ui/ResponsiveTable'

interface SiteData {
  siteId: string
  siteName: string
  count: number
}

interface DashboardSiteTableProps {
  data: SiteData[]
  color: 'red' | 'orange' | 'green'
  emptyMessage?: string
}

export default function DashboardSiteTable({ data, color, emptyMessage = 'No Data' }: DashboardSiteTableProps) {
  const getBadgeColor = (index: number) => {
    if (index > 0) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    switch (color) {
      case 'red': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'orange': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'green': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTextColor = () => {
    switch (color) {
      case 'red': return 'text-red-600 dark:text-red-400'
      case 'orange': return 'text-orange-600 dark:text-orange-400'
      case 'green': return 'text-green-600 dark:text-green-400'
      default: return 'text-gray-900'
    }
  }

  const columns: Column<SiteData>[] = [
    {
      key: 'siteName',
      header: 'Site',
      priority: 'primary',
      render: (item, index) => (
        <div className="flex items-center space-x-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getBadgeColor(index)}`}>
            #{index + 1}
          </span>
          <span className="truncate max-w-[120px] text-sm font-medium text-gray-900 dark:text-white" title={item.siteName}>
            {item.siteName}
          </span>
        </div>
      )
    },
    {
      key: 'count',
      header: 'Jml',
      priority: 'primary',
      align: 'right',
      render: (item) => (
        <span className={`font-bold ${getTextColor()}`}>
          {item.count}
        </span>
      )
    }
  ]

  return (
    <ResponsiveTable
      data={data}
      keyField="siteId"
      columns={columns}
      emptyMessage={emptyMessage}
      // Remove default shadow/border if needed, but ResponsiveTable has it. AdminDashboardClient wraps it in a card too.
      // We might need to adjust styling because AdminDashboardClient ALREADY wraps it in a styled div.
      // ResponsiveTable adds its own container with shadow/border.
      // We should probably pass className to override or remove wrapper styles if ResponsiveTable allows.
      // ResponsiveTable: <div className={`... shadow-sm border ... ${className}`}>
      // I can pass "shadow-none border-0" to remove double nesting style if needed.
    />
  )
}

'use client'

import React from 'react'
import ResponsiveTable, { type Column } from '@/components/ui/ResponsiveTable'
import { ColorBadge } from '@/components/common/ColorBadge'

interface ClosureDetailTableProps {
  data: any[]
  type: 'Input' | 'Output'
}

export default function ClosureDetailTable({ data, type }: ClosureDetailTableProps) {
  const columns: Column<any>[] = [
    {
      key: 'idx',
      header: 'No',
      priority: 'tertiary',
      render: (item) => <span className="text-sm font-medium text-gray-900 dark:text-white">{item.idx + 1}</span>,
      mobileLabel: '#'
    },
    {
      key: 'inputUnit',
      header: 'Input Unit',
      priority: 'primary',
      render: (item) => <span className="text-sm text-gray-900 dark:text-white">{item.inputUnit}</span>
    },
    {
      key: 'portUnit',
      header: 'Port Unit',
      priority: 'secondary',
      render: (item) => <span className="text-sm text-gray-900 dark:text-white">{item.portUnit}</span>
    },
    {
      key: 'tubeColor',
      header: 'Tube Color',
      priority: 'secondary',
      render: (item) => <ColorBadge color={item.tubeColor || 'Non-tube'} />
    },
    {
      key: 'coreColor',
      header: 'Core Color',
      priority: 'secondary',
      render: (item) => <ColorBadge color={item.coreColor || '-'} />
    }
  ]

  return (
    <ResponsiveTable
      data={data}
      keyField="id"
      columns={columns}
      emptyMessage={`Tidak ada data ${type.toLowerCase()}.`}
    />
  )
}

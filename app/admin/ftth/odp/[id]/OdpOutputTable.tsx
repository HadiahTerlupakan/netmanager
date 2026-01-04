'use client'

import React from 'react'
import Link from 'next/link'
import { ColorBadge } from '@/components/common/ColorBadge'
import ResponsiveTable from '@/components/ui/ResponsiveTable'
import type { Column } from '@/components/ui/ResponsiveTable'

interface OdpOutputTableProps {
  data: any[]
}

export function OdpOutputTable({ data }: OdpOutputTableProps) {
  const columns: Column<any>[] = [
    {
      key: 'idx',
      header: 'No',
      priority: 'primary',
      render: (item: any) => <span className="text-sm font-medium text-gray-900 dark:text-white">{item.idx + 1}</span>
    },
    {
      key: 'slotName',
      header: 'Nama Slot',
      priority: 'primary',
      render: (item: any) => <span className="text-sm text-gray-900 dark:text-white">{item.slotName}</span>
    },
    {
      key: 'redaman',
      header: 'Redaman',
      priority: 'secondary',
      render: (item: any) => (
        item.redaman != null ? (
          <span className="font-medium text-gray-900 dark:text-white">{item.redaman.toFixed(2)} dB</span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      )
    },
    {
      key: 'tubeColor',
      header: 'Tube Color',
      priority: 'secondary',
      render: (item: any) => <ColorBadge color={item.tubeColor || 'Non-tube'} />
    },
    {
      key: 'coreColor',
      header: 'Core Color',
      priority: 'secondary',
      render: (item: any) => <ColorBadge color={item.coreColor || '-'} />
    }
  ]

  return (
    <ResponsiveTable
      data={data}
      keyField="id"
      columns={columns}
    />
  )
}

'use client'

import React from 'react'
import Link from 'next/link'
import { ColorBadge } from '@/components/common/ColorBadge'
import { HiCheck } from 'react-icons/hi2'
import ResponsiveTable from '@/components/ui/ResponsiveTable'
import type { Column } from '@/components/ui/ResponsiveTable'

interface OdcOutputTableProps {
  data: any[]
}

export function OdcOutputTable({ data }: OdcOutputTableProps) {
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
    },
    {
      key: 'status',
      header: 'Status',
      priority: 'primary',
      render: (item: any) => (
        item.odp ? (
          <Link href={`/admin/ftth/odp/${item.odp.id}`} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-xs font-medium hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors">
            <HiCheck className="w-3 h-3" />
            Terhubung ke {item.odp.name}
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 text-xs font-medium">
            Tersedia
          </span>
        )
      )
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

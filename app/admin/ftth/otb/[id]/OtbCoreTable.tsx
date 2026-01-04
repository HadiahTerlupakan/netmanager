'use client'

import React from 'react'
import Link from 'next/link'
import { ColorBadge } from '@/components/common/ColorBadge'
import { HiCheck } from 'react-icons/hi2'
import ResponsiveTable from '@/components/ui/ResponsiveTable'
import type { Column } from '@/components/ui/ResponsiveTable'

interface OtbCoreTableProps {
  data: any[]
}

export function OtbCoreTable({ data }: OtbCoreTableProps) {
  const standard12Colors = ['Biru', 'Oranye', 'Hijau', 'Coklat', 'Slate', 'Putih', 'Merah', 'Hitam', 'Kuning', 'Ungu', 'Rose', 'Aqua']

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
      key: 'tubeColor',
      header: 'Tube Color',
      priority: 'secondary',
      render: (item: any) => {
        const tubeColor = item.tubeColor && item.tubeColor.trim() !== '' ? item.tubeColor : 'Non-tube'
        return <ColorBadge color={tubeColor} />
      }
    },
    {
      key: 'coreColor',
      header: 'Core Color',
      priority: 'secondary',
      render: (item: any) => {
        const coreColor = item.coreColor && item.coreColor.trim() !== '' ? item.coreColor : standard12Colors[item.idx % 12]
        return <ColorBadge color={coreColor} />
      }
    },
    {
      key: 'status',
      header: 'Status',
      priority: 'primary',
      render: (item: any) => (
        item.odc ? (
          <Link href={`/admin/ftth/odc/${item.odc.id}`} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
            <HiCheck className="w-3 h-3" />
            Terhubung ke {item.odc.name}
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
      emptyMessage="Belum ada mapping core."
    />
  )
}

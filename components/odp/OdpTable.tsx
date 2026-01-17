'use client'

import React from 'react'
import { OdpActions } from './OdpActions'
import { StatusBadge } from '@/components/common/StatusBadge'
import ResponsiveTable from '@/components/ui/ResponsiveTable'

type Odp = {
  id: string
  name: string
  location: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  outputCount: number
  siteName: string
  createdAt: string
}

interface OdpTableProps {
  odps: Odp[]
}

export default function OdpTable({ odps }: OdpTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-800">
      <ResponsiveTable
        data={odps}
        keyField="id"
        columns={[
          {
            key: 'name',
            header: 'Nama',
            priority: 'primary',
            render: (item) => <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
          },
          {
            key: 'status',
            header: 'Status',
            priority: 'secondary',
            render: (item) => <StatusBadge status={item.status} size="sm" />
          },
          {
            key: 'siteName',
            header: 'Site',
            priority: 'secondary',
            render: (item) => <span className="text-gray-700 dark:text-gray-300">{item.siteName}</span>
          },
          {
            key: 'outputCount',
            header: 'Jml Output',
            priority: 'primary',
            align: 'center',
            render: (item) => <span className="font-medium text-gray-900 dark:text-gray-100">{item.outputCount}</span>
          },
          {
            key: 'location',
            header: 'Lokasi',
            priority: 'secondary',
            render: (item) => <span className="text-gray-700 dark:text-gray-300">{item.location || '-'}</span>
          },
          {
            key: 'coordinates',
            header: 'Koordinat',
            priority: 'tertiary',
            render: (item) => (
              item.latitude != null && item.longitude != null ? (
                <span className="font-mono text-xs">{item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}</span>
              ) : (
                '-'
              )
            )
          },
          {
            key: 'notes',
            header: 'Catatan',
            priority: 'tertiary',
            render: (item) => <span className="max-w-xs truncate" title={item.notes || undefined}>{item.notes || '-'}</span>
          },
          {
            key: 'createdAt',
            header: 'Dibuat',
            priority: 'tertiary',
            align: 'right',
            render: (item) => new Date(item.createdAt).toLocaleString('id-ID')
          }
        ]}
        renderActions={(item) => <OdpActions id={item.id} status={item.status} />}
        emptyMessage="Belum ada data ODP."
      />
    </div>
  )
}

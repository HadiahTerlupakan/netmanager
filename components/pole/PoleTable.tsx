'use client'

import React from 'react'
import { PoleActions } from './PoleActions'
import { StatusBadge } from '@/components/common/StatusBadge'
import ResponsiveTable from '@/components/ui/ResponsiveTable'

type Pole = {
  id: string
  name: string
  location: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  cableSlack: boolean
  createdAt: string
}

interface PoleTableProps {
  poles: Pole[]
}

export default function PoleTable({ poles }: PoleTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-800">
      <ResponsiveTable
        data={poles}
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
            key: 'cableSlack',
            header: 'Cable Slack',
            priority: 'tertiary',
            render: (item) => (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${item.cableSlack
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                {item.cableSlack ? 'Ada' : 'Tidak'}
              </span>
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
        renderActions={(item) => <PoleActions id={item.id} status={item.status} />}
        emptyMessage="Belum ada data Pole."
      />
    </div>
  )
}

import { HiExclamationCircle, HiPencil, HiTrash } from 'react-icons/hi2'

import { SiteFilter } from '@/components/common/SiteFilter'
import { StatusBadge } from '@/components/common/StatusBadge'
import ResponsiveTable from '@/components/ui/ResponsiveTable'

import type { Bandwidth } from '@/app/admin/paket/bandwidth/lib/bandwidthTypes'

type BandwidthTableProps = {
  bandwidths: Bandwidth[]
  error: string | null
  siteId: string | undefined
  onSiteChange: (siteId: string | undefined) => void
  onAddClick: () => void
  onEdit: (bandwidth: Bandwidth) => void
  onDelete: (id: string) => void
}

export function BandwidthTable({
  bandwidths,
  error,
  siteId,
  onSiteChange,
  onAddClick,
  onEdit,
  onDelete,
}: BandwidthTableProps) {
  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span>Home</span> <span className="mx-2">/</span>
        <span>Paket</span> <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-white">Bandwidth</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bandwidth</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Kelola profil bandwidth untuk paket internet</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-full md:w-48">
            <SiteFilter
              value={siteId || ''}
              onSiteChange={onSiteChange}
              resource="bandwidth"
            />
          </div>
          <button
            type="button"
            onClick={onAddClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <span>+</span>
            Tambah Bandwidth
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <HiExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Error</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ResponsiveTable
          data={bandwidths}
          columns={[
            {
              key: 'name',
              header: 'Nama',
              priority: 'primary',
              render: (item: Bandwidth) => (
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</div>
                  {item.description && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.description}</div>
                  )}
                </div>
              ),
            },
            {
              key: 'maxLimitDownload',
              header: 'Max Limit D/U',
              priority: 'primary',
              render: (item: Bandwidth) => (
                <span className="text-sm text-gray-900 dark:text-white">{item.maxLimitDownload} / {item.maxLimitUpload}</span>
              ),
            },
            {
              key: 'burstLimitDownload',
              header: 'Burst Limit D/U',
              priority: 'secondary',
              render: (item: Bandwidth) => (
                item.burstLimitDownload && item.burstLimitUpload ? (
                  <span className="text-sm text-gray-900 dark:text-white">{item.burstLimitDownload} / {item.burstLimitUpload}</span>
                ) : <span className="text-sm text-gray-500">-</span>
              ),
            },
            {
              key: 'priority',
              header: 'Priority',
              priority: 'secondary',
              render: (item: Bandwidth) => (
                <span className="text-sm text-gray-900 dark:text-white">{item.priority || '-'}</span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              priority: 'primary',
              render: (item: Bandwidth) => <StatusBadge status={item.status} />,
            },
          ]}
          keyField="id"
          emptyMessage='Tidak ada data bandwidth. Klik "Tambah Bandwidth" untuk menambahkan.'
          renderActions={(item: Bandwidth) => (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="inline-flex items-center justify-center w-8 h-8 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
                title="Edit"
              >
                <HiPencil className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="Delete"
              >
                <HiTrash className="w-5 h-5" />
              </button>
            </div>
          )}
        />
      </div>
    </div>
  )
}

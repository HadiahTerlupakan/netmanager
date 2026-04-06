import { HiExclamationCircle, HiPencil, HiTrash } from 'react-icons/hi2'

import { SiteFilter } from '@/components/common/SiteFilter'
import { StatusBadge } from '@/components/common/StatusBadge'
import ResponsiveTable from '@/components/ui/ResponsiveTable'

import type { ProfilePPP } from '@/app/admin/paket/profileppp/lib/profilePppTypes'

type ProfilePppTableProps = {
  profilePPPs: ProfilePPP[]
  error: string | null
  siteId: string | undefined
  pppConnectionMode: 'RADIUS' | 'MIKROTIK_API'
  onSiteChange: (siteId: string | undefined) => void
  onAddClick: () => void
  onEdit: (profile: ProfilePPP) => void
  onDelete: (id: string) => void
}

export function ProfilePppTable({
  profilePPPs,
  error,
  siteId,
  pppConnectionMode,
  onSiteChange,
  onAddClick,
  onEdit,
  onDelete,
}: ProfilePppTableProps) {
  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span>Home</span> <span className="mx-2">/</span>
        <span>Paket</span> <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-white">Profile PPP</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile PPP</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Kelola profil PPPoE untuk autentikasi pelanggan</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-full md:w-48">
            <SiteFilter value={siteId || ''} onSiteChange={onSiteChange} resource="profileppp" />
          </div>
          <button
            type="button"
            onClick={onAddClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <span>+</span>
            Tambah Profile PPP
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
          data={profilePPPs}
          columns={[
            {
              key: 'name',
              header: 'Nama Profile',
              priority: 'primary',
              render: (item: ProfilePPP) => (
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</div>
                  {item.description && <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.description}</div>}
                </div>
              ),
            },
            {
              key: 'localAddress',
              header: 'Local Address',
              priority: 'primary',
              render: (item: ProfilePPP) => <span className="text-sm text-gray-900 dark:text-white">{item.localAddress}</span>,
            },
            {
              key: 'remoteAddress',
              header: 'Remote Address',
              priority: 'primary',
              render: (item: ProfilePPP) => <span className="text-sm text-gray-900 dark:text-white">{item.remoteAddress}</span>,
            },
            ...(pppConnectionMode === 'RADIUS' ? [{
              key: 'poolMode',
              header: 'Mode',
              priority: 'secondary' as const,
              render: (item: ProfilePPP) => (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  item.poolMode === 'RADIUS'
                    ? 'bg-purple-100 text-indigo-800 dark:bg-purple-900/30 dark:text-indigo-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                }`}>
                  {item.poolMode || 'MIKROTIK'}
                </span>
              ),
            }] : []),
            {
              key: 'dnsServer',
              header: 'DNS Server',
              priority: 'secondary',
              render: (item: ProfilePPP) => <span className="text-sm text-gray-900 dark:text-white">{item.dnsServer || '-'}</span>,
            },
            {
              key: 'mikroTikRouter',
              header: 'Target MikroTik',
              priority: 'secondary',
              render: (item: ProfilePPP) => (
                item.mikroTikRouter ? (
                  <div>
                    <div className="font-medium text-sm text-gray-900 dark:text-white">{item.mikroTikRouter.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{item.mikroTikRouter.ipAddress}</div>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">-</span>
                )
              ),
            },
            {
              key: 'paketTerkait',
              header: 'Paket Terkait',
              priority: 'secondary',
              render: (item: ProfilePPP) => <span className="text-sm text-gray-900 dark:text-white">{item._count?.hargaPaket || 0} paket</span>,
            },
            {
              key: 'status',
              header: 'Status',
              priority: 'primary',
              render: (item: ProfilePPP) => <StatusBadge status={item.status} />,
            },
          ]}
          keyField="id"
          emptyMessage='Tidak ada data profile PPP. Klik "Tambah Profile PPP" untuk menambahkan.'
          renderActions={(item: ProfilePPP) => (
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

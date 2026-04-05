import { HiExclamationCircle, HiPencil, HiStar, HiTrash } from 'react-icons/hi2'

import { SiteFilter } from '@/components/common/SiteFilter'
import { StatusBadge } from '@/components/common/StatusBadge'
import ResponsiveTable from '@/components/ui/ResponsiveTable'

import { calculateHargaListDisplay, formatRupiah } from '@/app/admin/paket/harga/lib/hargaPricing'
import type { HargaPaket } from '@/app/admin/paket/harga/lib/hargaTypes'

type HargaTableProps = {
  hargaPakets: HargaPaket[]
  loading: boolean
  error: string | null
  siteId: string | undefined
  onSiteChange: (siteId: string | undefined) => void
  onAddClick: () => void
  onEdit: (paket: HargaPaket) => void
  onDelete: (id: string) => void
}

export function HargaTable({
  hargaPakets,
  loading,
  error,
  siteId,
  onSiteChange,
  onAddClick,
  onEdit,
  onDelete,
}: HargaTableProps) {
  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span>Home</span> <span className="mx-2">/</span>
        <span>Paket</span> <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-white">Harga Paket</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Harga Paket</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Kelola paket internet dengan harga dan durasi</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-full md:w-48">
            <SiteFilter onSiteChange={onSiteChange} value={siteId ?? ''} resource="harga" />
          </div>
          <button
            type="button"
            onClick={onAddClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <span>+</span>
            Tambah Paket
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

      {loading ? null : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <ResponsiveTable
            data={hargaPakets}
            columns={[
              {
                key: 'name',
                header: 'Nama Paket',
                priority: 'primary',
                render: (item: HargaPaket) => (
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</div>
                      {item.description && <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.description}</div>}
                    </div>
                    {item.featured && <HiStar className="w-5 h-5 text-yellow-500" title="Paket Unggulan" />}
                  </div>
                ),
              },
              {
                key: 'profilePPP',
                header: 'Profile PPP',
                priority: 'secondary',
                render: (item: HargaPaket) => (
                  <div>
                    <div className="text-sm text-gray-900 dark:text-white">{item.profilePPP.name}</div>
                    {item.bandwidth && <div className="text-xs text-gray-500 dark:text-gray-400">BW: {item.bandwidth.name}</div>}
                  </div>
                ),
              },
              {
                key: 'site',
                header: 'Site',
                priority: 'secondary',
                render: (item: HargaPaket) => (
                  <span className="text-sm text-gray-900 dark:text-white">{item.site?.name || '-'}</span>
                ),
              },
              {
                key: 'harga',
                header: 'Harga',
                priority: 'primary',
                render: (item: HargaPaket) => {
                  const { discountedPrice, priceWithPpn } = calculateHargaListDisplay(item)
                  return (
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      <div>{formatRupiah(item.harga)}</div>
                      {item.useDiscount && item.discountType && item.discountValue && (
                        <>
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                            - Diskon: {item.discountType === 'FIXED' ? formatRupiah(item.discountValue) : `${item.discountValue}%`} = {formatRupiah(discountedPrice ?? item.harga)}
                          </div>
                          {item.discountDuration && item.discountDurationUnit && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Durasi: {item.discountDuration} {item.discountDurationUnit === 'JAM' ? 'jam' : item.discountDurationUnit === 'HARI' ? 'hari' : item.discountDurationUnit === 'BULAN' ? 'bulan' : 'tahun'}
                            </div>
                          )}
                        </>
                      )}
                      {item.usePPN && item.ppnPercentage && priceWithPpn !== null && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          + PPN {item.ppnPercentage}% = {formatRupiah(priceWithPpn)}
                        </div>
                      )}
                    </div>
                  )
                },
              },
              {
                key: 'durasi',
                header: 'Durasi',
                priority: 'secondary',
                render: (item: HargaPaket) => (
                  <span className="text-sm text-gray-900 dark:text-white">
                    {item.durasi} {item.durasiUnit === 'JAM' ? 'jam' : item.durasiUnit === 'HARI' ? 'hari' : item.durasiUnit === 'BULAN' ? 'bulan' : 'tahun'}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                priority: 'primary',
                render: (item: HargaPaket) => <StatusBadge status={item.status} />,
              },
            ]}
            keyField="id"
            emptyMessage='Tidak ada data paket. Klik "Tambah Paket" untuk menambahkan.'
            renderActions={(item: HargaPaket) => (
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
      )}
    </div>
  )
}

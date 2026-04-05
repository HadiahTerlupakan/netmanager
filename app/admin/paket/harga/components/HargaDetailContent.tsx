import { HiClock, HiCurrencyDollar, HiServer, HiSignal, HiTag, HiXMark } from 'react-icons/hi2'
import { FiMonitor } from 'react-icons/fi'

import { StatusBadge } from '@/components/common/StatusBadge'

import { PricingSummary } from '@/app/admin/paket/harga/components/PricingSummary'
import { formatRupiah } from '@/app/admin/paket/harga/lib/hargaPricing'
import type { HargaPaketDetail } from '@/app/admin/paket/harga/lib/hargaTypes'

type HargaDetailContentProps = {
  paket: HargaPaketDetail | null
  loading: boolean
  error: string | null
}

function DetailItem({ label, value, icon: Icon, className = '' }: { label: string; value: React.ReactNode; icon?: React.ElementType; className?: string }) {
  return (
    <div className={`p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 ${className}`}>
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
      </div>
      <div className="font-semibold text-gray-900 dark:text-white break-all">
        {value || <span className="text-gray-400 dark:text-gray-600 italic">Tidak diset</span>}
      </div>
    </div>
  )
}

export function HargaDetailContent({ paket, loading, error }: HargaDetailContentProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20">
        <HiXMark className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">{error}</p>
      </div>
    )
  }

  if (!paket) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-700 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{paket.name}</h3>
            <StatusBadge status={paket.status} />
            {paket.featured && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
                Unggulan
              </span>
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-400 max-w-lg">{paket.description || 'Tidak ada deskripsi'}</p>
        </div>
        {paket.site && (
          <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-full border border-indigo-100 dark:border-indigo-800">
            {paket.site.name} ({paket.site.code})
          </div>
        )}
      </div>

      <div>
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-4">
          <HiCurrencyDollar className="w-4 h-4 text-green-500" />
          RINCIAN HARGA
        </h4>
        <PricingSummary mode="detail" paket={paket} />
      </div>

      <div>
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-4 mt-6">
          <FiMonitor className="w-4 h-4 text-indigo-500" />
          KONFIGURASI TEKNIS
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailItem
            label="Profile PPP"
            value={paket.profilePPP.name}
            className="bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/20"
          />

          <DetailItem
            label="Router MikroTik"
            value={paket.profilePPP.mikroTikRouter ? (
              <div className="flex flex-col">
                <span>{paket.profilePPP.mikroTikRouter.name}</span>
                <span className="text-xs font-normal text-gray-500">{paket.profilePPP.mikroTikRouter.ipAddress}</span>
              </div>
            ) : <span className="text-gray-400 italic">Tidak terhubung ke router</span>}
            icon={HiServer}
          />

          <DetailItem
            label="Durasi"
            value={`${paket.durasi} ${paket.durasiUnit}`}
            icon={HiClock}
          />

          <DetailItem
            label="Diskon"
            value={paket.useDiscount && paket.discountValue ? (
              <span>
                {paket.discountType === 'PERCENT' ? `${paket.discountValue}%` : formatRupiah(paket.discountValue)}
                {paket.discountDuration && paket.discountDurationUnit ? ` • ${paket.discountDuration} ${paket.discountDurationUnit}` : ''}
              </span>
            ) : 'Tidak ada'}
            icon={HiTag}
          />

          <div className="md:col-span-2">
            <div className={`p-4 rounded-xl border ${paket.bandwidth ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/20' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/50'}`}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <HiSignal className="w-4 h-4" />
                  Bandwidth / Rate Limit
                </span>
                {paket.bandwidth && (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded uppercase">
                    {paket.bandwidth.name}
                  </span>
                )}
              </div>
              {paket.bandwidth ? (
                <div className="flex items-center gap-8">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Download</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{paket.bandwidth.maxLimitDownload}</div>
                  </div>
                  <div className="h-8 w-px bg-gray-200 dark:bg-gray-700"></div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Upload</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{paket.bandwidth.maxLimitUpload}</div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 dark:text-gray-400 italic text-sm">
                  Rate limit mengikuti setting default Profile PPP
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

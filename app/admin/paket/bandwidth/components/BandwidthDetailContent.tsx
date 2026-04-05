import { HiCurrencyDollar, HiSignal, HiXMark } from 'react-icons/hi2'

import { StatusBadge } from '@/components/common/StatusBadge'

import type { BandwidthDetail } from '@/app/admin/paket/bandwidth/lib/bandwidthTypes'

type BandwidthDetailContentProps = {
  bandwidth: BandwidthDetail | null
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

const formatRate = (download?: string | null, upload?: string | null) => {
  if (!download && !upload) return null
  return `${download || '-'} / ${upload || '-'}`
}

export function BandwidthDetailContent({ bandwidth, loading, error }: BandwidthDetailContentProps) {
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

  if (!bandwidth) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-700 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{bandwidth.name}</h3>
            <StatusBadge status={bandwidth.status} />
          </div>
          <p className="text-gray-500 dark:text-gray-400 max-w-lg">{bandwidth.description || 'Tidak ada deskripsi'}</p>
        </div>
        {bandwidth.site && (
          <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-full border border-indigo-100 dark:border-indigo-800">
            {bandwidth.site.name}
          </div>
        )}
      </div>

      <div>
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-4">
          <HiSignal className="w-4 h-4 text-blue-500" />
          KONFIGURASI RATE LIMIT (Download / Upload)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Max Limit (Utama)</span>
            </div>
            <div className="flex items-center gap-8">
              <div>
                <div className="text-xs text-gray-500 mb-1">Download</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{bandwidth.maxLimitDownload}</div>
              </div>
              <div className="h-10 w-px bg-gray-200 dark:bg-gray-700"></div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Upload</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{bandwidth.maxLimitUpload}</div>
              </div>
            </div>
          </div>

          <DetailItem label="Burst Limit" value={formatRate(bandwidth.burstLimitDownload, bandwidth.burstLimitUpload)} />
          <DetailItem label="Burst Threshold" value={formatRate(bandwidth.burstThresholdDownload, bandwidth.burstThresholdUpload)} />
          <DetailItem label="Burst Time" value={bandwidth.burstTimeDownload || bandwidth.burstTimeUpload ? `${bandwidth.burstTimeDownload || '-'}s / ${bandwidth.burstTimeUpload || '-'}s` : null} />
          <DetailItem label="Min Limit" value={formatRate(bandwidth.minLimitDownload, bandwidth.minLimitUpload)} />
          <DetailItem label="Priority" value={bandwidth.priority} />
        </div>
      </div>

      <div>
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-4 mt-2">
          <HiCurrencyDollar className="w-4 h-4 text-green-500" />
          PAKET MENGGUNAKAN BANDWIDTH INI ({bandwidth.hargaPaket?.length || 0})
        </h4>

        {bandwidth.hargaPaket && bandwidth.hargaPaket.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama Paket</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Profile PPP</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Harga</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {bandwidth.hargaPaket.map((paket) => (
                  <tr key={paket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{paket.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{paket.profilePPP?.name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(paket.harga)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada paket internet yang menggunakan bandwidth ini</p>
          </div>
        )}
      </div>
    </div>
  )
}

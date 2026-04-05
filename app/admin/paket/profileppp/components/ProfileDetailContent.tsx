import { HiClock, HiServer, HiSignal, HiXMark } from 'react-icons/hi2'
import { FiMonitor } from 'react-icons/fi'

import { StatusBadge } from '@/components/common/StatusBadge'

import { formatTimeout } from '@/app/admin/paket/profileppp/lib/profilePppHelpers'
import type { ProfileDetail } from '@/app/admin/paket/profileppp/lib/profilePppTypes'

type ProfileDetailContentProps = {
  profile: ProfileDetail | null
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

export function ProfileDetailContent({ profile, loading, error }: ProfileDetailContentProps) {
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

  if (!profile) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-700 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{profile.name}</h3>
            <StatusBadge status={profile.status} />
          </div>
          <p className="text-gray-500 dark:text-gray-400 max-w-lg">{profile.description || 'Tidak ada deskripsi'}</p>
        </div>
        {profile.site && (
          <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-full border border-indigo-100 dark:border-indigo-800">
            {profile.site.name}
          </div>
        )}
      </div>

      <div>
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-4">
          <FiMonitor className="w-4 h-4 text-indigo-500" />
          KONFIGURASI JARINGAN
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailItem label="Local Address" value={profile.localAddress} />
          <DetailItem label="Remote Address (Pool)" value={profile.remoteAddress} />

          <div className="md:col-span-2 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
            <div className="flex items-start justify-between mb-1">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Live IP Pool Range (MikroTik)</span>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 dark:bg-blue-800 rounded text-[10px] font-bold text-blue-700 dark:text-blue-300">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                LIVE
              </div>
            </div>
            <div className="font-mono text-lg font-medium text-gray-900 dark:text-white">
              {profile.ipRange || <span className="text-gray-400 italic">Tidak terdeteksi / Static</span>}
            </div>
          </div>

          <DetailItem label="DNS Server" value={profile.dnsServer?.split(',').join(', ')} />
          <DetailItem
            label="Target Router"
            value={profile.mikroTikRouter ? (
              <div className="flex flex-col">
                <span>{profile.mikroTikRouter.name}</span>
                <span className="text-xs font-normal text-gray-500">{profile.mikroTikRouter.ipAddress}</span>
              </div>
            ) : null}
            icon={HiServer}
          />
        </div>
      </div>

      <div>
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-4 mt-2">
          <HiClock className="w-4 h-4 text-orange-500" />
          LIMIT & TIMEOUT
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <DetailItem label="Session Timeout" value={formatTimeout(profile.sessionTimeout)} />
          <DetailItem label="Idle Timeout" value={formatTimeout(profile.idleTimeout)} />
        </div>
      </div>

      <div>
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-4 mt-2">
          <HiSignal className="w-4 h-4 text-green-500" />
          PAKET TERHUBUNG ({profile.hargaPaket?.length || 0})
        </h4>

        {profile.hargaPaket && profile.hargaPaket.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama Paket</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Harga</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bandwidth (Rate Limit)</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {profile.hargaPaket.map((paket) => (
                  <tr key={paket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{paket.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(paket.harga)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {paket.bandwidth ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          {paket.bandwidth.maxLimitDownload}/{paket.bandwidth.maxLimitUpload}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada paket internet yang menggunakan profile ini</p>
          </div>
        )}
      </div>
    </div>
  )
}

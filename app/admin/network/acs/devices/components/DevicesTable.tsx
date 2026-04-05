import { AlertTriangle, ChevronLeft, ChevronRight, Eye, Radio, RefreshCw, Trash2, Wifi } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import type { Device } from '@/app/admin/network/acs/devices/lib/acsDeviceTypes'

type DevicesTableProps = {
  loading: boolean
  devices: Device[]
  currentPage: number
  totalPages: number
  startIndex: number
  itemsPerPage: number
  filteredDevicesLength: number
  onPrevPage: () => void
  onNextPage: () => void
  onView: (deviceId: string) => void
  onSummon: (deviceId: string) => void
  onDelete: (deviceId: string) => void
}

const getRxPowerColor = (rx: string | null) => {
  if (!rx) return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
  const power = parseFloat(rx)
  if (isNaN(power)) return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
  if (power >= -23) return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
  if (power >= -26) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
  return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
}

const isOnline = (lastInform: string | null) => {
  if (!lastInform) return false
  const informDate = new Date(lastInform)
  const now = new Date()
  const diffMins = (now.getTime() - informDate.getTime()) / 60000
  return diffMins <= 10
}

export function DevicesTable({
  loading,
  devices,
  currentPage,
  totalPages,
  startIndex,
  itemsPerPage,
  filteredDevicesLength,
  onPrevPage,
  onNextPage,
  onView,
  onSummon,
  onDelete,
}: DevicesTableProps) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-[#f8fafc] dark:bg-gray-900/50">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">STATUS</th>
              <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">SERIAL / MODEL</th>
              <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">PPPOE / IP ADDRESS</th>
              <th scope="col" className="px-6 py-4 text-center text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">WIFI (SSID)</th>
              <th scope="col" className="px-6 py-4 text-center text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">RX POWER</th>
              <th scope="col" className="px-6 py-4 text-center text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">LAST INFORM</th>
              <th scope="col" className="px-6 py-4 text-center text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                  Memuat data perangkat...
                </td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
                  Tidak ada perangkat yang ditemukan
                </td>
              </tr>
            ) : (
              devices.map((device) => {
                const online = isOnline(device.lastInform)
                return (
                  <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={'inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-bold ' + (online ? 'bg-[#dcfce7] dark:bg-green-900/30 text-[#166534] dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400')}>
                        <span className={'w-2 h-2 rounded-full mr-2 ' + (online ? 'bg-[#22c55e]' : 'bg-red-500')}></span>
                        {online ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={'flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ' + (online ? 'bg-[#3b5fe5] dark:bg-blue-600' : 'bg-gray-400 dark:bg-gray-600')}>
                          {device.manufacturer ? device.manufacturer.charAt(0).toUpperCase() : 'O'}
                        </div>
                        <div className="ml-4">
                          <div className="text-[13px] font-bold text-gray-900 dark:text-white">{device.serialNumber || '-'}</div>
                          <div className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">{device.productClass || 'Unknown Model'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[13px] font-bold text-gray-900 dark:text-white">{device.pppoe || '-'}</div>
                      <div className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 font-mono">{device.ipAddress || '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center text-[12px] font-medium text-gray-700 dark:text-gray-300">
                        <Wifi className="w-3.5 h-3.5 mr-1.5 text-blue-500 dark:text-blue-400" />
                        {device.ssid || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={'inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-bold ' + getRxPowerColor(device.rxpower)}>
                        {device.rxpower ? `${device.rxpower} dBm` : '-'}
                      </span>
                      {device.temperature && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{device.temperature}°C</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-[12px] font-medium text-gray-700 dark:text-gray-300">
                        {device.lastInform ? formatDistanceToNow(new Date(device.lastInform), { addSuffix: true }) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center space-x-2">
                      <button
                        type="button"
                        onClick={() => onView(device.id)}
                        className="inline-flex items-center px-2.5 py-1.5 bg-[#f3e8ff] dark:bg-purple-900/30 text-[#9333ea] dark:text-purple-400 rounded text-[12px] font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
                        title="Detail Device"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSummon(device.id)}
                        className="inline-flex items-center px-2.5 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[12px] font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        title="Summon (Connection Request)"
                      >
                        <Radio className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(device.id)}
                        className="inline-flex items-center px-2.5 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-[12px] font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        title="Hapus dari ACS"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && filteredDevicesLength > 0 && (
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
          <p className="text-[13px] text-gray-500 dark:text-gray-400">
            Menampilkan <span className="font-bold text-gray-900 dark:text-white">{startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredDevicesLength)}</span> dari <span className="font-bold text-gray-900 dark:text-white">{filteredDevicesLength}</span> perangkat
          </p>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onPrevPage}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-[13px] text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </button>
            <button
              type="button"
              onClick={onNextPage}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-[13px] text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

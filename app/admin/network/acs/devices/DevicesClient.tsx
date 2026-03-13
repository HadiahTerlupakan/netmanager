"use client"

import { useState, useEffect } from 'react'
import { RefreshCw, Search, Wifi, AlertTriangle, ChevronLeft, ChevronRight, Activity, Eye, Trash2, Radio } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'

interface Device {
  id: string
  serialNumber: string
  productClass: string
  manufacturer: string
  tags: string[]
  pppoe: string | null
  wanbridge: string | null
  rxpower: string | null
  temperature: string | null
  activeDevices: string | null
  ssid: string | null
  ipAddress: string | null
  lastInform: string | null
}

export function DevicesClient() {
  const router = useRouter()
  const { showToast } = useToast()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const fetchDevices = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/acs/devices')
      const result = await res.json()
      if (result.success && result.data) {
        setDevices(result.data.devices || [])
      } else {
        showToast('error', result.error || 'Gagal memuat perangkat')
      }
    } catch (_err) {
      showToast('error', 'Terjadi kesalahan saat memuat data perangkat')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevices()
    const interval = setInterval(fetchDevices, 300000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSummon = async (deviceId: string) => {
    try {
      showToast('info', 'Mengirim perintah Summon...')
      const res = await fetch(`/api/acs/devices/${encodeURIComponent(deviceId)}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionRequest: true })
      })
      const result = await res.json()
      if (result.success) {
        showToast('success', 'Summon berhasil, perangkat akan segera melapor')
        setTimeout(fetchDevices, 3000)
      } else {
        showToast('error', result.error || 'Gagal summon perangkat')
      }
    } catch (_err) {
      showToast('error', 'Terjadi kesalahan sistem saat summon')
    }
  }

  const handleDelete = async (deviceId: string) => {
    if (!confirm('Hapus perangkat ini dari ACS? Data historis mungkin akan hilang.')) return
    try {
      const res = await fetch(`/api/acs/devices/${encodeURIComponent(deviceId)}`, {
        method: 'DELETE'
      })
      const result = await res.json()
      if (result.success) {
        showToast('success', 'Perangkat berhasil dihapus')
        fetchDevices()
      } else {
        showToast('error', result.error || 'Gagal menghapus perangkat')
      }
    } catch (_err) {
      showToast('error', 'Terjadi kesalahan sistem saat menghapus')
    }
  }

  const filteredDevices = devices.filter(d => 
    d.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.productClass?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.pppoe?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.ipAddress?.includes(searchTerm)
  )

  // Pagination Logic
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedDevices = filteredDevices.slice(startIndex, startIndex + itemsPerPage)

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

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pt-4 pb-12">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h2 className="text-[22px] font-bold text-gray-900 dark:text-white flex items-center">
              <Activity className="w-6 h-6 mr-2 text-[#3b5fe5] dark:text-blue-400" /> ONT Devices
            </h2>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">Kelola dan monitor seluruh perangkat Router/ONT yang terhubung</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Cari Serial / PPPoE / IP..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1) // Reset to page 1 on search
                }}
                className="pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[13px] w-64 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
            <button 
              onClick={fetchDevices} 
              disabled={loading}
              className="px-4 py-2 bg-[#3b5fe5] text-white rounded-md text-[13px] font-medium hover:bg-blue-700 flex items-center shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={"w-4 h-4 mr-1.5 " + (loading ? 'animate-spin' : '')} /> Refresh
            </button>
          </div>
        </div>

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
              ) : paginatedDevices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
                    Tidak ada perangkat yang ditemukan
                  </td>
                </tr>
              ) : (
                paginatedDevices.map((device) => {
                  const online = isOnline(device.lastInform)
                  
                  return (
                    <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={"inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-bold " + (online ? 'bg-[#dcfce7] dark:bg-green-900/30 text-[#166534] dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400')}>
                          <span className={"w-2 h-2 rounded-full mr-2 " + (online ? 'bg-[#22c55e]' : 'bg-red-500')}></span>
                          {online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className={"flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold " + (online ? 'bg-[#3b5fe5] dark:bg-blue-600' : 'bg-gray-400 dark:bg-gray-600')}>
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
                        <span className={"inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-bold " + getRxPowerColor(device.rxpower)}>
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
                          onClick={() => router.push('/admin/network/acs/devices/' + device.id)}
                          className="inline-flex items-center px-2.5 py-1.5 bg-[#f3e8ff] dark:bg-purple-900/30 text-[#9333ea] dark:text-purple-400 rounded text-[12px] font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
                          title="Detail Device"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleSummon(device.id)}
                          className="inline-flex items-center px-2.5 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[12px] font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                          title="Summon (Connection Request)"
                        >
                          <Radio className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(device.id)}
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
        
        {!loading && filteredDevices.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
            <p className="text-[13px] text-gray-500 dark:text-gray-400">
              Menampilkan <span className="font-bold text-gray-900 dark:text-white">{startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredDevices.length)}</span> dari <span className="font-bold text-gray-900 dark:text-white">{filteredDevices.length}</span> perangkat
            </p>
            <div className="flex space-x-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-[13px] text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-[13px] text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

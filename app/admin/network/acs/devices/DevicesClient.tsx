"use client"

import { useMemo, useState } from 'react'

import { Activity } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/ui/Toast'

import { DevicesTable } from '@/app/admin/network/acs/devices/components/DevicesTable'
import { DevicesToolbar } from '@/app/admin/network/acs/devices/components/DevicesToolbar'
import { useDevicesPolling } from '@/app/admin/network/acs/devices/hooks/useDevicesPolling'

export function DevicesClient() {
  const router = useRouter()
  const { showToast } = useToast()
  const { devices, loading, refresh } = useDevicesPolling({ showToast })
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const filteredDevices = useMemo(() => {
    return devices.filter((device) =>
      device.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.productClass?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.pppoe?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.ipAddress?.includes(searchTerm)
    )
  }, [devices, searchTerm])

  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedDevices = filteredDevices.slice(startIndex, startIndex + itemsPerPage)

  const handleSummon = async (deviceId: string) => {
    try {
      showToast('info', 'Mengirim perintah Summon...')
      const res = await fetch(`/api/acs/devices/${encodeURIComponent(deviceId)}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionRequest: true }),
      })
      const result = await res.json()
      if (result.success) {
        showToast('success', 'Summon berhasil, perangkat akan segera melapor')
        setTimeout(() => {
          void refresh()
        }, 3000)
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
        method: 'DELETE',
      })
      const result = await res.json()
      if (result.success) {
        showToast('success', 'Perangkat berhasil dihapus')
        await refresh()
      } else {
        showToast('error', result.error || 'Gagal menghapus perangkat')
      }
    } catch (_err) {
      showToast('error', 'Terjadi kesalahan sistem saat menghapus')
    }
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

          <DevicesToolbar
            searchTerm={searchTerm}
            loading={loading}
            onSearchChange={(value) => {
              setSearchTerm(value)
              setCurrentPage(1)
            }}
            onRefresh={() => {
              void refresh()
            }}
          />
        </div>

        <DevicesTable
          loading={loading}
          devices={paginatedDevices}
          currentPage={currentPage}
          totalPages={totalPages}
          startIndex={startIndex}
          itemsPerPage={itemsPerPage}
          filteredDevicesLength={filteredDevices.length}
          onPrevPage={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          onNextPage={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          onView={(deviceId) => router.push('/admin/network/acs/devices/' + deviceId)}
          onSummon={(deviceId) => {
            void handleSummon(deviceId)
          }}
          onDelete={(deviceId) => {
            void handleDelete(deviceId)
          }}
        />
      </div>
    </div>
  )
}

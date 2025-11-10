"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/common/ToastProvider'
import { HiCheckCircle, HiXCircle, HiCog } from 'react-icons/hi2'

type StatusChangeButtonProps = {
  id: string
  currentStatus: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  apiEndpoint: string
  entityName: string
}

export function StatusChangeButton({ id, currentStatus, apiEndpoint, entityName }: StatusChangeButtonProps) {
  const router = useRouter()
  const { show } = useToast()
  const [changing, setChanging] = useState(false)

  const statusOrder: Array<'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'> = ['AKTIF', 'NONAKTIF', 'MAINTENANCE']
  
  const getNextStatus = (): 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE' => {
    const currentIndex = statusOrder.indexOf(currentStatus)
    const nextIndex = (currentIndex + 1) % statusOrder.length
    return statusOrder[nextIndex]
  }

  const getStatusConfig = (status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE') => {
    switch (status) {
      case 'AKTIF':
        return {
          color: 'text-green-600 dark:text-green-400',
          borderColor: 'border-green-300 dark:border-green-700',
          hoverBg: 'hover:bg-green-50 dark:hover:bg-green-900/20',
          label: 'Aktif',
          icon: <HiCheckCircle className="h-4 w-4" />
        }
      case 'NONAKTIF':
        return {
          color: 'text-gray-600 dark:text-gray-400',
          borderColor: 'border-gray-300 dark:border-gray-700',
          hoverBg: 'hover:bg-gray-50 dark:hover:bg-gray-800',
          label: 'Nonaktif',
          icon: <HiXCircle className="h-4 w-4" />
        }
      case 'MAINTENANCE':
        return {
          color: 'text-yellow-600 dark:text-yellow-400',
          borderColor: 'border-yellow-300 dark:border-yellow-700',
          hoverBg: 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
          label: 'Maintenance',
          icon: <HiCog className="h-4 w-4" />
        }
    }
  }

  const currentConfig = getStatusConfig(currentStatus)
  const nextStatus = getNextStatus()
  const nextConfig = getStatusConfig(nextStatus)

  async function handleClick() {
    if (changing) return

    setChanging(true)
    try {
      const res = await fetch(apiEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })

      if (res.ok) {
        show({
          type: 'success',
          title: 'Berhasil',
          message: `Status ${entityName} berhasil diubah menjadi ${nextConfig.label}`,
        })
        router.refresh()
      } else {
        const json = await res.json()
        const errorMessage = typeof json.error === 'string' ? json.error : 'Gagal mengubah status'
        show({
          type: 'error',
          title: 'Gagal',
          message: errorMessage,
        })
      }
    } catch (error: any) {
      show({
        type: 'error',
        title: 'Error',
        message: error.message || 'Terjadi kesalahan',
      })
    } finally {
      setChanging(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={changing}
      className={`inline-flex items-center justify-center h-8 w-8 rounded border ${currentConfig.borderColor} ${currentConfig.color} ${currentConfig.hoverBg} disabled:opacity-50 transition-colors`}
      title={`Status: ${currentConfig.label} - Klik untuk mengubah ke ${nextConfig.label}`}
    >
      {currentConfig.icon}
    </button>
  )
}


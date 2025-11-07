"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/common/ToastProvider'

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
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
          )
        }
      case 'NONAKTIF':
        return {
          color: 'text-gray-600 dark:text-gray-400',
          borderColor: 'border-gray-300 dark:border-gray-700',
          hoverBg: 'hover:bg-gray-50 dark:hover:bg-gray-800',
          label: 'Nonaktif',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
            </svg>
          )
        }
      case 'MAINTENANCE':
        return {
          color: 'text-yellow-600 dark:text-yellow-400',
          borderColor: 'border-yellow-300 dark:border-yellow-700',
          hoverBg: 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
          label: 'Maintenance',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.592c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281zM15 12a3 3 0 11-6 0 3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          )
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


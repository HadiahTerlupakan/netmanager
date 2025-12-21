'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FiArrowLeft } from 'react-icons/fi'
import { GudangForm } from '@/components/inventory/GudangForm'

interface Gudang {
  id: string
  kode: string
  nama: string
  lokasi: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export function ClientComponent({ params }: { params: Promise<{ id: string }> }) {
  const [gudang, setGudang] = useState<Gudang | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gudangId, setGudangId] = useState<string | null>(null)

  useEffect(() => {
    async function getParams() {
      const { id } = await params
      setGudangId(id)
    }
    getParams()
  }, [params])

  useEffect(() => {
    if (!gudangId) return

    async function fetchGudang() {
      try {
        const response = await fetch(`/api/inventory/gudang/${gudangId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Gagal memuat data gudang')
        }

        setGudang(data.gudang)
      } catch (error) {
        console.error('Failed to fetch gudang:', error)
        setError(error instanceof Error ? error.message : 'Gagal memuat data')
      } finally {
        setLoading(false)
      }
    }

    fetchGudang()
  }, [gudangId])

  const handleSuccess = () => {
    // Redirect back to gudang list
    window.location.href = '/admin/inventory/gudang'
  }

  const handleCancel = () => {
    // Go back to previous page
    window.history.back()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Memuat data gudang...</p>
        </div>
      </div>
    )
  }

  if (error || !gudang) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Link
            href="/admin/inventory/gudang"
            className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <FiArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Edit Gudang
            </h1>
          </div>
        </div>

        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error || 'Gudang tidak ditemukan'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <Link
          href="/admin/inventory/gudang"
          className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <FiArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Gudang
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ubah informasi lokasi gudang
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <GudangForm
            initialData={gudang}
            onSubmit={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  )
}
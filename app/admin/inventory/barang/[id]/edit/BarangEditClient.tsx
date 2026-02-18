'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { FiArrowLeft } from 'react-icons/fi'
import { BarangForm } from '@/components/inventory/BarangForm'

interface BarangData {
  id: string
  kode: string
  nama: string
  satuan: string
}

export function ClientComponent() {
  const router = useRouter()
  const params = useParams()
  const [initialData, setInitialData] = useState<BarangData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchBarang() {
      try {
        const response = await fetch(`/api/inventory/barang/${params.id}`)

        if (!response.ok) {
          throw new Error('Barang tidak ditemukan')
        }

        const jsonResponse = await response.json()
        setInitialData(jsonResponse.data?.barang || jsonResponse.barang || jsonResponse)
      } catch (error: unknown) {
        console.error('Error fetching barang:', error)
        setError(error instanceof Error ? error.message : 'Gagal memuat data barang')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchBarang()
    }
  }, [params.id])

  const handleSubmit = async () => {
    // Redirect to inventory page after successful update
    router.push('/admin/inventory')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Memuat data barang...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-md p-6">
            <h3 className="text-lg font-medium text-red-800">Error</h3>
            <p className="mt-2 text-red-600">{error}</p>
            <Link
              href="/admin/inventory"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-400"
            >
              <span className="text-white">Kembali ke Inventory</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!initialData) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <Link
          href={`/admin/inventory/barang/${params.id}`}
          className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <FiArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Barang: {initialData.kode}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Update informasi barang
          </p>
        </div>
      </div>

      {/* Form Container */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Informasi Barang
          </h2>
        </div>
        <div className="p-6">
          <BarangForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/admin/inventory/barang/${params.id}`)}
          />
        </div>
      </div>
    </div>
  )
}
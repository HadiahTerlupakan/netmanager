'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FiArrowLeft,
  FiEdit,
  FiEye,
  FiDownload,
  FiUpload,
  FiClipboard
} from 'react-icons/fi'
import ResponsiveTable from '@/components/ui/ResponsiveTable'

export function ClientComponent() {
  const params = useParams()
  const router = useRouter()
  const [barang, setBarang] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchBarang() {
      try {
        const response = await fetch(`/api/inventory/barang/${params.id}`)

        if (!response.ok) {
          throw new Error('Barang tidak ditemukan')
        }

        const data = await response.json()
        const barangData = data.barang || data

        // Map stok/barangGudang to stockPerGudang if needed
        const rawStock = barangData.barangGudang || barangData.stok
        if (rawStock && !barangData.stockPerGudang) {
          barangData.stockPerGudang = rawStock.map((s: any) => ({
            gudangId: s.gudangId,
            gudangKode: s.gudang?.kode,
            gudangNama: s.gudang?.nama,
            stok: s.stok
          }))
        }

        setBarang(barangData)
      } catch (error) {
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
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
            >
              Kembali ke Inventory
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!barang) {
    return null
  }

  const getStockStatusColor = (stock: number) => {
    if (stock === 0) return 'bg-red-100 text-red-800'
    if (stock < 5) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const totalStock = barang.stockPerGudang?.reduce((sum: number, stock: any) => sum + stock.stok, 0) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link
            href="/admin/inventory"
            className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <FiArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {barang.kode} - {barang.nama}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Detail informasi dan stok barang
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href={`/admin/inventory/barang/${barang.id}/edit`}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <FiEdit className="h-4 w-4 mr-1" />
            Edit
          </Link>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="shrink-0">
                <FiEye className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Total Stok
                  </dt>
                  <dd className="flex items-baseline">
                    <div className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStockStatusColor(totalStock)}`}>
                      {totalStock} {barang.satuan}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="shrink-0">
                <div className="h-6 w-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-xs font-bold">{barang.kode.slice(-1)}</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Kode Barang
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900 dark:text-white">
                      {barang.kode}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="shrink-0">
                <div className="h-6 w-6 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-xs font-bold">S</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Satuan
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900 dark:text-white">
                      {barang.satuan}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="shrink-0">
                <div className="h-6 w-6 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 text-xs font-bold">G</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Jumlah Gudang
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900 dark:text-white">
                      {barang.stockPerGudang?.length || 0} gudang
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stock per Gudang */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
            Stok per Gudang
          </h3>

          {barang.stockPerGudang?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                Barang ini belum memiliki stok di gudang manapun
              </p>
              <div className="mt-4 flex justify-center space-x-3">
                <Link
                  href="/admin/inventory/masuk"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  <FiDownload className="h-4 w-4 mr-2" />
                  Barang Masuk
                </Link>
                <Link
                  href="/admin/inventory/opname"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
                >
                  <FiClipboard className="h-4 w-4 mr-2" />
                  Stock Opname
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden">
              <ResponsiveTable
                data={barang.stockPerGudang || []}
                keyField="gudangId"
                columns={[
                  {
                    key: 'gudangNama',
                    header: 'Gudang',
                    priority: 'primary',
                    render: (item: any) => (
                      <div className="font-medium text-gray-900 dark:text-white">
                        {item.gudangNama}
                        <div className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">
                          {item.gudangKode}
                        </div>
                      </div>
                    )
                  },
                  {
                    key: 'gudangKode',
                    header: 'Kode',
                    priority: 'secondary',
                    render: (item: any) => (
                      <span className="text-gray-500 dark:text-gray-400">{item.gudangKode}</span>
                    )
                  },
                  {
                    key: 'stok',
                    header: 'Stok',
                    priority: 'primary',
                    render: (item: any) => (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStockStatusColor(item.stok)}`}>
                        {item.stok} {barang.satuan}
                      </span>
                    )
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    priority: 'secondary',
                    render: (item: any) => (
                      <span className="text-gray-500 dark:text-gray-400">
                        {item.stok === 0 ? 'Habis' : item.stok < 5 ? 'Menipis' : 'Tersedia'}
                      </span>
                    )
                  }
                ]}
                renderActions={(item: any) => (
                  <div className="flex justify-end space-x-2">
                    <Link
                      href="/admin/inventory/masuk"
                      className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 p-2"
                      title="Barang Masuk"
                    >
                      <FiDownload className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/admin/inventory/keluar"
                      className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300 p-2"
                      title="Barang Keluar"
                    >
                      <FiUpload className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/admin/inventory/opname"
                      className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 p-2"
                      title="Stock Opname"
                    >
                      <FiClipboard className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
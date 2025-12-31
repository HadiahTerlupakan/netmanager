'use client'

import { useState, useEffect } from 'react'
import { TransferForm } from '@/components/inventory/TransferForm'
import { TransferTable } from '@/components/inventory/TransferTable'
import { Modal } from '@/components/ui/Modal'

export default function TransferPage() {
  const [transfers, setTransfers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  const fetchTransfers = async (page = 1) => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch(`/api/inventory/transfer?page=${page}&limit=${pagination.limit}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memuat data transfer')
      }

      setTransfers(data.transferList || [])
      setPagination(prev => ({
        ...prev,
        page,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0
      }))
    } catch (error) {
      console.error('Error fetching transfers:', error)
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransfers()
  }, [])

  const handleViewDetails = (transfer: any) => {
    setSelectedTransfer(transfer)
    setShowDetails(true)
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchTransfers(newPage)
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Transfer Antar Gudang</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Kelola pemindahan barang antar gudang
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Transfer Baru
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
          <button
            onClick={() => fetchTransfers()}
            className="ml-2 text-red-600 underline hover:text-red-800"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Transfers List */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600 dark:text-gray-400">Memuat data transfer...</span>
            </div>
          ) : (
            <>
              <TransferTable
                transfers={transfers}
                onRefresh={() => fetchTransfers(pagination.page)}
                onViewDetails={handleViewDetails}
                onDelete={() => { }} // This is handled in the table component
              />

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Menampilkan {((pagination.page - 1) * pagination.limit) + 1} hingga{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} dari{' '}
                    {pagination.total} data
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm">
                      Halaman {pagination.page} dari {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Transfer Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Transfer Barang Antar Gudang"
        size="lg"
      >
        <TransferForm
          onClose={() => setShowForm(false)}
          onSuccess={() => fetchTransfers(1)} // Refresh first page on success
        />
      </Modal>

      {/* Transfer Details Modal */}
      <Modal
        isOpen={showDetails && !!selectedTransfer}
        onClose={() => {
          setShowDetails(false)
          setSelectedTransfer(null)
        }}
        title="Detail Transfer"
        size="lg"
      >
        {selectedTransfer && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Kode Transfer</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedTransfer.kodeTransfer}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tanggal</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(selectedTransfer.tanggal).toLocaleString('id-ID')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Barang</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedTransfer.barang?.kode} - {selectedTransfer.barang?.nama}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Jumlah</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedTransfer.jumlah} {selectedTransfer.barang?.satuan}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Kondisi</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${selectedTransfer.kondisi === 'BARU' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                    selectedTransfer.kondisi === 'BEKAS' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                    }`}>
                    {selectedTransfer.kondisi}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-2">Gudang Sumber</p>
                <p className="font-medium text-red-900 dark:text-red-300">
                  {selectedTransfer.dariGudang?.kode} - {selectedTransfer.dariGudang?.nama}
                </p>
                {selectedTransfer.dariGudang?.lokasi && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {selectedTransfer.dariGudang?.lokasi}
                  </p>
                )}
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-2">Gudang Tujuan</p>
                <p className="font-medium text-green-900 dark:text-green-300">
                  {selectedTransfer.keGudang?.kode} - {selectedTransfer.keGudang?.nama}
                </p>
                {selectedTransfer.keGudang?.lokasi && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    {selectedTransfer.keGudang?.lokasi}
                  </p>
                )}
              </div>
            </div>

            {selectedTransfer.keterangan && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Keterangan</p>
                <p className="text-gray-900 dark:text-white">{selectedTransfer.keterangan}</p>
              </div>
            )}

            {/* Foto Bukti */}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Foto Bukti</p>
              {selectedTransfer.fotoBukti && selectedTransfer.fotoBukti.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedTransfer.fotoBukti.length} foto terlampir
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedTransfer.fotoBukti.map((url: string, index: number) => (
                      <div
                        key={index}
                        className="relative overflow-hidden rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 cursor-pointer"
                        style={{ minHeight: '200px' }}
                        onClick={() => window.open(url, '_blank')}
                      >
                        <img
                          src={url}
                          alt={`Foto bukti ${index + 1}`}
                          className="w-full h-48 object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = `
                              <div class="flex flex-col items-center justify-center h-48 text-gray-400">
                                <svg class="h-12 w-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                <p class="text-sm">Gagal memuat gambar</p>
                              </div>
                            `;
                          }}
                          loading="eager"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <svg className="h-8 w-8 mx-auto text-gray-400 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada foto bukti</p>
                </div>
              )}
            </div>

            {/* Related Transactions */}
            {selectedTransfer.masuk && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Transaksi Terkait</p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="space-y-2">
                    {selectedTransfer.keluar && (
                      <div className="flex items-center space-x-2">
                        <span className="text-red-600 dark:text-red-400">Keluar:</span>
                        <span className="text-sm">
                          {new Date(selectedTransfer.keluar.tanggal).toLocaleString('id-ID')} - {selectedTransfer.keluar.keterangan}
                        </span>
                      </div>
                    )}
                    {selectedTransfer.masuk && (
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600 dark:text-green-400">Masuk:</span>
                        <span className="text-sm">
                          {new Date(selectedTransfer.masuk.tanggal).toLocaleString('id-ID')} - {selectedTransfer.masuk.keterangan}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

    </div>
  )
}
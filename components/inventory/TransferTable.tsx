'use client'

import { useState } from 'react'
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle
} from 'react-icons/fi'

interface TransferTableProps {
  transfers: any[]
  onRefresh: () => void
  onViewDetails: (transfer: any) => void
  onDelete: (transfer: any) => void
}

export function TransferTable({ transfers, onRefresh, onViewDetails, onDelete }: TransferTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (transfer: any) => {
    if (!confirm(`Apakah Anda yakin ingin membatalkan transfer ini?\n\nKode: ${transfer.kodeTransfer}\nBarang: ${transfer.barang.nama}\nJumlah: ${transfer.jumlah} ${transfer.barang.satuan}\n\nStok akan dikembalikan ke gudang sumber.`)) {
      return
    }

    setDeletingId(transfer.id)
    try {
      const response = await fetch(`/api/inventory/transfer/${transfer.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Gagal membatalkan transfer')
      }

      onRefresh()
    } catch (error) {
      console.error('Error deleting transfer:', error)
      alert(error instanceof Error ? error.message : 'Gagal membatalkan transfer')
    } finally {
      setDeletingId(null)
    }
  }

  const getKondisiBadge = (kondisi: string) => {
    const colors = {
      BARU: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      BEKAS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      RUSAK: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${colors[kondisi as keyof typeof colors] || colors.BARU}`}>
        {kondisi === 'BARU' && <FiCheckCircle className="w-3 h-3" />}
        {kondisi === 'BEKAS' && <FiAlertTriangle className="w-3 h-3" />}
        {kondisi === 'RUSAK' && <FiXCircle className="w-3 h-3" />}
        <span>{kondisi}</span>
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (transfers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
          <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Belum ada data transfer</h3>
        <p className="text-gray-500 dark:text-gray-400">
          Transfer barang antar gudang akan muncul di sini
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {transfers.map((transfer) => (
          <li key={transfer.id}>
            <div className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  {/* Transfer Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">
                        {transfer.kodeTransfer}
                      </p>
                      {getKondisiBadge(transfer.kondisi)}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(transfer.tanggal)}
                    </p>
                  </div>

                  {/* Transfer Info */}
                  <div className="flex items-center space-x-4 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Barang:</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {transfer.barang.kode} - {transfer.barang.nama}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Jumlah:</span>
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {transfer.jumlah} {transfer.barang.satuan}
                      </span>
                    </div>
                  </div>

                  {/* Transfer Flow */}
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="flex items-center text-red-600 dark:text-red-400">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {transfer.dariGudang.kode}
                    </span>

                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>

                    <span className="flex items-center text-green-600 dark:text-green-400">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      {transfer.keGudang.kode}
                    </span>
                  </div>

                  {/* Keterangan */}
                  {transfer.keterangan && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Keterangan:</span> {transfer.keterangan}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => onViewDetails(transfer)}
                    className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Detail
                  </button>
                  <button
                    onClick={() => handleDelete(transfer)}
                    disabled={deletingId === transfer.id}
                    className="inline-flex items-center px-2.5 py-1.5 border border-red-300 dark:border-red-600 shadow-sm text-xs font-medium rounded text-red-700 dark:text-red-300 bg-white dark:bg-red-900/20 hover:bg-red-50 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    {deletingId === transfer.id ? (
                      <>
                        <svg className="animate-spin -ml-0.5 mr-1 h-3 w-3 text-red-600 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Batal...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Batal
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
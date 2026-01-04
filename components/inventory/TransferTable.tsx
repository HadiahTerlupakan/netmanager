'use client'

import { useState } from 'react'
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiTrash2,
  FiEye,
  FiArrowRight
} from 'react-icons/fi'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'

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

  const columns: Column<any>[] = [
    {
      key: 'kodeTransfer',
      header: 'Kode',
      priority: 'primary',
      render: (item) => (
        <span className="font-medium text-indigo-600 dark:text-indigo-400">
          {item.kodeTransfer}
        </span>
      )
    },
    {
      key: 'barang',
      header: 'Barang',
      priority: 'primary',
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900 dark:text-white">
            {item.barang?.nama || 'Unknown'}
          </span>
          <span className="text-xs text-gray-500">
            {item.jumlah} {item.barang?.satuan}
          </span>
        </div>
      )
    },
    {
      key: 'rute',
      header: 'Rute',
      priority: 'secondary',
      render: (item) => (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-red-600 dark:text-red-400 font-medium">
            {item.dariGudang?.kode || 'N/A'}
          </span>
          <FiArrowRight className="w-4 h-4 text-gray-400" />
          <span className="text-green-600 dark:text-green-400 font-medium">
            {item.keGudang?.kode || 'N/A'}
          </span>
        </div>
      )
    },
    {
      key: 'kondisi',
      header: 'Kondisi',
      priority: 'secondary',
      render: (item) => getKondisiBadge(item.kondisi)
    },
    {
      key: 'tanggal',
      header: 'Tanggal',
      priority: 'tertiary',
      render: (item) => new Date(item.tanggal).toLocaleString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    },
    {
      key: 'keterangan',
      header: 'Ket',
      priority: 'tertiary',
      render: (item) => (
        <span className="text-sm text-gray-500 max-w-xs truncate block" title={item.keterangan}>
          {item.keterangan || '-'}
        </span>
      )
    }
  ]

  return (
    <ResponsiveTable
      data={transfers}
      columns={columns}
      keyField="id"
      emptyMessage="Belum ada data transfer barang antar gudang."
      renderActions={(item) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewDetails(item)}
            className="p-2 text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors"
            title="Detail"
          >
            <FiEye className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleDelete(item)}
            disabled={deletingId === item.id}
            className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors disabled:opacity-50"
            title="Batalkan Transfer"
          >
            {deletingId === item.id ? (
              <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <FiTrash2 className="w-5 h-5" />
            )}
          </button>
        </div>
      )}
    />
  )
}
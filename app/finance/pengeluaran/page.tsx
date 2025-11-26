"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiArrowPath, HiBars3, HiOutlineBanknotes, HiOutlinePlus, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi2'
import { useFinance } from '@/hooks/useFinance'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

const formatDate = (dateString: string | Date) => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function FinancePengeluaranPage() {
  const router = useRouter()
  const { data: financeUser, loading, refreshing, refresh } = useFinance()
  const [pengeluarans, setPengeluarans] = useState<any[]>([])
  const [pengeluaranLoading, setPengeluaranLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const fetchPengeluarans = async () => {
      try {
        const token = localStorage.getItem('finance_token')
        if (!token) return

        const response = await fetch('/api/finance/pengeluaran', {
          headers: {
            'x-finance-token': token,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setPengeluarans(data)
        }
      } catch (error) {
        console.error('Error fetching pengeluarans:', error)
      } finally {
        setPengeluaranLoading(false)
      }
    }

    if (financeUser) {
      fetchPengeluarans()
      // Auto-refresh setiap 30 detik
      const interval = setInterval(fetchPengeluarans, 30000)
      return () => clearInterval(interval)
    }
  }, [financeUser])

  const handleRefresh = () => {
    refresh()
    setPengeluaranLoading(true)
    const token = localStorage.getItem('finance_token')
    if (token) {
      fetch('/api/finance/pengeluaran', {
        headers: { 'x-finance-token': token },
      })
        .then(res => res.json())
        .then(data => {
          setPengeluarans(data)
          setPengeluaranLoading(false)
        })
        .catch(err => {
          console.error('Error refreshing pengeluarans:', err)
          setPengeluaranLoading(false)
        })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    const idToDelete = deleteId
    setDeleteId(null) // Close dialog immediately
    try {
      const token = localStorage.getItem('finance_token')
      const response = await fetch(`/api/finance/pengeluaran/${idToDelete}`, {
        method: 'DELETE',
        headers: {
          'x-finance-token': token || '',
        },
      })

      if (response.ok) {
        setPengeluarans(pengeluarans.filter(p => p.id !== idToDelete))
        handleRefresh() // Refresh data
      } else {
        const data = await response.json()
        alert(data.error || 'Gagal menghapus pengeluaran')
      }
    } catch (error) {
      console.error('Error deleting pengeluaran:', error)
      alert('Terjadi kesalahan saat menghapus pengeluaran')
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading || pengeluaranLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <HiArrowPath className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto mb-4" />
          <div className="text-gray-500 dark:text-gray-400">Memuat data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg md:ml-0">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if ((window as any).toggleFinanceSidebar) {
                    ; (window as any).toggleFinanceSidebar()
                  }
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation md:hidden"
                aria-label="Open menu"
              >
                <HiBars3 className="w-6 h-6" />
              </button>
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <HiOutlineBanknotes className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold">Pengeluaran</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/finance/pengeluaran/new"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
                title="Tambah Pengeluaran"
              >
                <HiOutlinePlus className="w-6 h-6" />
              </Link>
              <button
                onClick={handleRefresh}
                disabled={loading || refreshing || pengeluaranLoading}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation disabled:opacity-50"
                title="Refresh"
              >
                <HiArrowPath className={`w-6 h-6 ${loading || refreshing || pengeluaranLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 md:px-6 lg:px-8">
        {/* Add Button - Desktop */}
        <div className="mb-4 hidden md:block">
          <Link
            href="/finance/pengeluaran/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <HiOutlinePlus className="w-5 h-5" />
            Tambah Pengeluaran
          </Link>
        </div>

        {/* Pengeluaran List */}
        <div className="space-y-3">
          {pengeluarans.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
              <HiOutlineBanknotes className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">Belum ada data pengeluaran</p>
              <Link
                href="/finance/pengeluaran/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <HiOutlinePlus className="w-5 h-5" />
                Tambah Pengeluaran Pertama
              </Link>
            </div>
          ) : (
            pengeluarans.map((pengeluaran) => (
              <div
                key={pengeluaran.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                        {pengeluaran.kategori}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(pengeluaran.tanggal)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      {pengeluaran.deskripsi}
                    </p>
                    {pengeluaran.metodeBayar && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Metode: {pengeluaran.metodeBayar}
                      </p>
                    )}
                    {pengeluaran.catatan && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {pengeluaran.catatan}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">
                        {formatRupiah(pengeluaran.jumlah)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/finance/pengeluaran/${pengeluaran.id}/edit`}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <HiOutlinePencil className="w-5 h-5" />
                      </Link>
                      <button
                        onClick={() => setDeleteId(pengeluaran.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Hapus"
                      >
                        <HiOutlineTrash className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      {deleteId && (
        <ConfirmDialog
          open={!!deleteId}
          onCancel={() => setDeleteId(null)}
          onConfirm={handleDelete}
          title="Hapus Pengeluaran"
          description="Apakah Anda yakin ingin menghapus pengeluaran ini? Tindakan ini tidak dapat dibatalkan."
          confirmText="Hapus"
          cancelText="Batal"
        />
      )}
    </div>
  )
}


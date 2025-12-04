"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiArrowPath, HiBars3, HiOutlineDocumentText } from 'react-icons/hi2'
import { useFinance } from '@/hooks/useFinance'
import PageLoader from '@/components/ui/PageLoader'

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function FinanceTagihanPage() {
  const router = useRouter()
  const { data: financeUser, loading, refreshing, refresh } = useFinance()
  const [tagihans, setTagihans] = useState<any[]>([])
  const [tagihanLoading, setTagihanLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    const fetchTagihans = async () => {
      try {
        const token = localStorage.getItem('finance_token')
        if (!token) return

        const url = filterStatus === 'all'
          ? '/api/finance/tagihan'
          : `/api/finance/tagihan?status=${filterStatus}`

        const response = await fetch(url, {
          headers: {
            'x-finance-token': token,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setTagihans(data)
        }
      } catch (error) {
        console.error('Error fetching tagihans:', error)
      } finally {
        setTagihanLoading(false)
      }
    }

    if (financeUser) {
      fetchTagihans()
    }
  }, [financeUser, filterStatus])

  if (loading || tagihanLoading) {
    return <PageLoader />
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      LUNAS: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      BELUM_LUNAS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      TERLAMBAT: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    }
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg md:ml-0 safe-area-inset-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <button
                onClick={() => {
                  if ((window as any).toggleFinanceSidebar) {
                    ; (window as any).toggleFinanceSidebar()
                  }
                }}
                className="touch-target touch-manipulation p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors md:hidden flex-shrink-0"
                aria-label="Open menu"
              >
                <HiBars3 className="w-6 h-6" />
              </button>
              <div className="w-9 h-9 md:w-10 md:h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <HiOutlineDocumentText className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <h1 className="text-lg md:text-xl font-bold truncate">Kelola Tagihan</h1>
            </div>
            <button
              onClick={() => {
                refresh()
                setTagihanLoading(true)
                const token = localStorage.getItem('finance_token')
                if (token) {
                  const url = filterStatus === 'all'
                    ? '/api/finance/tagihan'
                    : `/api/finance/tagihan?status=${filterStatus}`
                  fetch(url, {
                    headers: { 'x-finance-token': token },
                  })
                    .then(res => res.json())
                    .then(data => {
                      setTagihans(data)
                      setTagihanLoading(false)
                    })
                    .catch(err => {
                      console.error('Error refreshing tagihans:', err)
                      setTagihanLoading(false)
                    })
                }
              }}
              disabled={loading || refreshing || tagihanLoading}
              className="touch-target touch-manipulation p-2 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
              title="Refresh"
            >
              <HiArrowPath className={`w-6 h-6 ${loading || refreshing || tagihanLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 md:px-6 lg:px-8">
        {/* Filter */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          <button
            onClick={() => setFilterStatus('all')}
            className={`touch-target touch-manipulation px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 ${filterStatus === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilterStatus('BELUM_LUNAS')}
            className={`touch-target touch-manipulation px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 ${filterStatus === 'BELUM_LUNAS'
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
          >
            Belum Lunas
          </button>
          <button
            onClick={() => setFilterStatus('TERLAMBAT')}
            className={`touch-target touch-manipulation px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 ${filterStatus === 'TERLAMBAT'
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
          >
            Terlambat
          </button>
          <button
            onClick={() => setFilterStatus('LUNAS')}
            className={`touch-target touch-manipulation px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 ${filterStatus === 'LUNAS'
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
          >
            Lunas
          </button>
        </div>

        {/* Tagihan List */}
        <div className="space-y-3">
          {tagihans.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">Tidak ada tagihan ditemukan</p>
            </div>
          ) : (
            tagihans.map((tagihan) => (
              <div
                key={tagihan.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {tagihan.noTagihan || `TAG-${tagihan.id.slice(0, 8)}`}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(tagihan.status)}`}>
                        {tagihan.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {tagihan.pelanggan?.nama || 'Pelanggan tidak ditemukan'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Periode: {new Date(tagihan.periodeTahun, tagihan.periodeBulan - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Jatuh Tempo: {formatDate(tagihan.jatuhTempo)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatRupiah(tagihan.total)}
                    </p>
                    {tagihan.tanggalBayar && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Dibayar: {formatDate(tagihan.tanggalBayar)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}





import { getTagihanRepository, getPengeluaranRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { HiOutlineBanknotes, HiOutlineArrowDownCircle, HiOutlineArrowUpCircle, HiOutlinePlus } from 'react-icons/hi2'
import Link from 'next/link'

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

export default async function CashflowPage() {
  const tagihanRepo = getTagihanRepository()
  const pengeluaranRepo = getPengeluaranRepository()
  const allTagihans = await tagihanRepo.findAll()
  
  // Try to get pengeluaran, fallback to empty array if model doesn't exist yet
  let allPengeluarans = []
  try {
    allPengeluarans = await pengeluaranRepo.findAll()
  } catch (error: any) {
    console.warn('Error fetching pengeluaran:', error.message)
    // If model doesn't exist yet, use empty array
    allPengeluarans = []
  }

  // Hitung total pemasukan (tagihan yang sudah lunas)
  const totalPemasukan = allTagihans
    .filter(t => t.status === 'LUNAS')
    .reduce((sum, t) => sum + t.total, 0)

  // Hitung total pengeluaran
  const totalPengeluaran = allPengeluarans.reduce((sum, p) => sum + p.jumlah, 0)

  // Hitung saldo
  const saldo = totalPemasukan - totalPengeluaran

  // Group tagihan per bulan
  const cashflowPerBulan = allTagihans.reduce((acc, tagihan) => {
    const key = `${tagihan.periodeTahun}-${String(tagihan.periodeBulan).padStart(2, '0')}`
    if (!acc[key]) {
      acc[key] = {
        bulan: tagihan.periodeBulan,
        tahun: tagihan.periodeTahun,
        pemasukan: 0,
        pengeluaran: 0,
        tagihanLunas: 0,
        tagihanBelumLunas: 0,
      }
    }
    if (tagihan.status === 'LUNAS') {
      acc[key].pemasukan += tagihan.total
      acc[key].tagihanLunas += 1
    } else {
      acc[key].tagihanBelumLunas += 1
    }
    return acc
  }, {} as Record<string, {
    bulan: number
    tahun: number
    pemasukan: number
    pengeluaran: number
    tagihanLunas: number
    tagihanBelumLunas: number
  }>)

  // Group pengeluaran per bulan
  allPengeluarans.forEach((pengeluaran) => {
    const tanggal = new Date(pengeluaran.tanggal)
    const bulan = tanggal.getMonth() + 1
    const tahun = tanggal.getFullYear()
    const key = `${tahun}-${String(bulan).padStart(2, '0')}`
    
    if (!cashflowPerBulan[key]) {
      cashflowPerBulan[key] = {
        bulan,
        tahun,
        pemasukan: 0,
        pengeluaran: 0,
        tagihanLunas: 0,
        tagihanBelumLunas: 0,
      }
    }
    cashflowPerBulan[key].pengeluaran += pengeluaran.jumlah
  })

  const tagihanPerBulanArray = Object.values(cashflowPerBulan).sort((a, b) => {
    if (a.tahun !== b.tahun) return b.tahun - a.tahun
    return b.bulan - a.bulan
  })

  // Get nama bulan
  const getNamaBulan = (bulan: number) => {
    const bulanNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]
    return bulanNames[bulan - 1]
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cashflow</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Laporan arus kas masuk dan keluar</p>
        </div>
        <Link
          href="/admin/finance/pengeluaran/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Tambah Pengeluaran
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Pemasukan */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Total Pemasukan
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatRupiah(totalPemasukan)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Dari tagihan yang sudah lunas
              </p>
            </div>
            <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <HiOutlineArrowDownCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Pengeluaran */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Total Pengeluaran
              </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatRupiah(totalPengeluaran)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Belum ada data pengeluaran
              </p>
            </div>
            <div className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <HiOutlineArrowUpCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        {/* Saldo */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Saldo
              </p>
              <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatRupiah(saldo)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Pemasukan - Pengeluaran
              </p>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <HiOutlineBanknotes className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Cashflow per Bulan */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cashflow per Bulan</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Rincian pemasukan dan pengeluaran per bulan
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Periode
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Pemasukan
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Pengeluaran
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Saldo
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status Tagihan
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {tagihanPerBulanArray.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Belum ada data cashflow
                  </td>
                </tr>
              ) : (
                tagihanPerBulanArray.map((item) => {
                  const saldoBulan = item.pemasukan - item.pengeluaran
                  return (
                    <tr key={`${item.tahun}-${item.bulan}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {getNamaBulan(item.bulan)} {item.tahun}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-green-600 dark:text-green-400">
                          {formatRupiah(item.pemasukan)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-red-600 dark:text-red-400">
                          {formatRupiah(item.pengeluaran)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-bold ${saldoBulan >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatRupiah(saldoBulan)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            {item.tagihanLunas} Lunas
                          </span>
                          {item.tagihanBelumLunas > 0 && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                              {item.tagihanBelumLunas} Belum Lunas
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


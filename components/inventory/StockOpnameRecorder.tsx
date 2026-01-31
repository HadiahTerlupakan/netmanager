'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  FiPackage,
  FiMapPin,
  FiCheck,
  FiAlertTriangle,
  FiBarChart2
} from 'react-icons/fi'

interface StockOpnameRecorderProps {
  onClose?: () => void
  onSuccess?: () => void
}

interface CalculatedOpnameData {
  barangId: string
  barangKode: string
  barangNama: string
  stokSistem: number
  stokFisik: number
  kondisiBaik: number
  kondisiRusak: number
  kondisiExpire: number
  lokasiPenyimpanan?: string
  nomorRak?: string
  nomorBox?: string
  pic?: string
  suhuPenyimpanan?: number
  kelembaban?: number
  tanggalExpire?: string
  nomorBatch?: string
  catatanDetail?: string
}

interface Gudang {
  id: string
  kode: string
  nama: string
}

interface OpnameSummary {
  totalBarang: number
  totalStok: number
}

export function StockOpnameRecorder({ onClose, onSuccess }: StockOpnameRecorderProps) {
  const [gudangId, setGudangId] = useState('')
  const [gudangs, setGudangs] = useState<Gudang[]>([])
  const [calculatedData, setCalculatedData] = useState<CalculatedOpnameData[]>([])
  const [summary, setSummary] = useState<OpnameSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  useEffect(() => {
    async function fetchGudangs() {
      try {
        const response = await fetch('/api/inventory/gudang?view=all')
        const data = await response.json()
        setGudangs(data.gudangs || [])
      } catch (error) {
        console.error('Error fetching gudangs:', error)
        setError('Gagal memuat data gudang')
      }
    }

    fetchGudangs()
  }, [])

  const fetchCalculatedData = useCallback(async () => {
    setFetching(true)
    setError('')

    try {
      const response = await fetch(`/api/inventory/opname/calculate?gudangId=${gudangId}`)
      if (!response.ok) throw new Error('Gagal menghitung data stock opname')

      const data = await response.json()
      setCalculatedData(data.items || [])
      setSummary(data.summary)

    } catch (error) {
      console.error('Error fetching calculated data:', error)
      setError(error instanceof Error ? error.message : 'Gagal memuat data stock opname')
    } finally {
      setFetching(false)
    }
  }, [gudangId])

  useEffect(() => {
    if (gudangId) {
      fetchCalculatedData()
    }
  }, [gudangId, fetchCalculatedData])

  const handleRecordOpname = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!gudangId) {
      setError('Pilih gudang terlebih dahulu')
      return
    }

    // Only record items with discrepancies
    const itemsToRecord = calculatedData.filter(item => {
      const hasDiscrepancy = item.stokFisik !== item.stokSistem
      const hasDamage = item.kondisiRusak > 0 || item.kondisiExpire > 0
      return hasDiscrepancy || hasDamage
    })

    if (itemsToRecord.length === 0) {
      setError('Tidak ada item yang perlu dicatat (tidak ada perbedaan)')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const promises = itemsToRecord.map(async (item) => {
        const response = await fetch('/api/inventory/opname', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            barangId: item.barangId,
            gudangId,
            stokFisik: item.stokFisik,
            keterangan: `Stock Opname Otomatis ${new Date().toLocaleDateString('id-ID')} - ${item.catatanDetail || 'Berdasarkan transaksi aktual'}`,
            kondisiBaik: item.kondisiBaik,
            kondisiRusak: item.kondisiRusak,
            kondisiExpire: item.kondisiExpire,
            lokasiPenyimpanan: item.lokasiPenyimpanan || undefined,
            nomorRak: item.nomorRak || undefined,
            nomorBox: item.nomorBox || undefined,
            pic: item.pic || undefined,
            suhuPenyimpanan: item.suhuPenyimpanan || undefined,
            kelembaban: item.kelembaban || undefined,
            tanggalExpire: item.tanggalExpire || undefined,
            nomorBatch: item.nomorBatch || undefined,
            catatanDetail: item.catatanDetail || undefined
          }),
        })

        if (!response.ok) {
          const responseData = await response.json()
          throw new Error(responseData.error || 'Gagal mencatat stock opname')
        }

        return response.json()
      })

      await Promise.all(promises)

      setSuccess(`Stock opname berhasil dicatat untuk ${itemsToRecord.length} item!`)

      if (onSuccess) {
        setTimeout(() => {
          onSuccess()
        }, 1500)
      } else {
        setTimeout(() => {
          router.push('/admin/inventory/opname/reports')
        }, 2000)
      }

    } catch (error) {
      console.error('Error recording stock opname:', error)
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const selectedGudang = gudangs.find(g => g.id === gudangId)
  const itemsWithDiscrepancies = calculatedData.filter(item => {
    return item.stokFisik !== item.stokSistem
  })

  const getConditionBadge = (baik: number, rusak: number, bekas: number) => {
    const total = baik + rusak + bekas
    if (total === 0) return null
    const persentase = (baik / total) * 100

    if (persentase >= 95) {
      return { color: 'bg-green-100 text-green-800', text: 'Sangat Baik' }
    } else if (persentase >= 85) {
      return { color: 'bg-yellow-100 text-yellow-800', text: 'Baik' }
    } else {
      return { color: 'bg-red-100 text-red-800', text: 'Perlu Perhatian' }
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleRecordOpname} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 flex items-start">
            <FiAlertTriangle className="mt-0.5 mr-2 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-800 flex items-center">
            <FiCheck className="mr-2 shrink-0" />
            <div>{success}</div>
          </div>
        )}

        {/* Gudang Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="mb-4">
            <label htmlFor="gudangId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FiMapPin className="inline mr-2" />
              Pilih Gudang untuk Stock Opname *
            </label>
            <select
              id="gudangId"
              value={gudangId}
              onChange={(e) => setGudangId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={loading}
            >
              <option value="">-- Pilih Gudang --</option>
              {gudangs.map((gudang) => (
                <option key={gudang.id} value={gudang.id}>
                  {gudang.kode} - {gudang.nama}
                </option>
              ))}
            </select>
          </div>

          {selectedGudang && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-300 flex items-center gap-2">
                <FiBarChart2 className="w-4 h-4" /> Input Stock Opname - Stok Fisik
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                Input hasil hitungan stok fisik dan kondisi aktual di {selectedGudang.nama}
              </p>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Ringkasan Inventory {selectedGudang?.nama}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-300">Total Jenis Barang</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{summary.totalBarang}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <p className="text-sm font-medium text-green-900 dark:text-green-300">Total Stok Sistem</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-300">{summary.totalStok}</p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Instruksi:</strong> Bandingkan stok sistem dengan stok fisik yang Anda hitung.
                Input jumlah stok fisik yang sebenarnya dan breakdown kondisi aktual di lapangan.
              </p>
            </div>
          </div>
        )}

        {/* Stock Data Table */}
        {fetching && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Memuat data stok sistem...</p>
          </div>
        )}

        {!fetching && gudangId && calculatedData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Input Stock Opname - Hitung Stok Fisik
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Bandingkan stok sistem dengan hasil hitungan fisik di {selectedGudang?.nama}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Barang
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Stok Sistem
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Baik
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Rusak
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Bekas
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Lokasi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {calculatedData.map((item) => {
                    const hasDiscrepancy = item.stokFisik !== item.stokSistem
                    const needsRecording = hasDiscrepancy
                    const conditionBadge = getConditionBadge(item.kondisiBaik, item.kondisiRusak, item.kondisiExpire)

                    return (
                      <tr key={item.barangId} className={`${needsRecording ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.barangKode}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {item.barangNama}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <div className="flex flex-col items-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${item.stokSistem === 0 ? 'bg-red-100 text-red-800' :
                              item.stokSistem < 5 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                              {item.stokSistem}
                            </span>
                            <span className="text-xs text-gray-500 mt-1">Sistem</span>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={item.kondisiBaik}
                            onChange={(e) => {
                              const newValue = parseInt(e.target.value) || 0
                              const updatedData = calculatedData.map(d =>
                                d.barangId === item.barangId
                                  ? {
                                    ...d,
                                    kondisiBaik: newValue,
                                    stokFisik: newValue + item.kondisiRusak + item.kondisiExpire
                                  }
                                  : d
                              )
                              setCalculatedData(updatedData)
                            }}
                            className="w-16 px-1 py-1 text-center border border-green-300 rounded focus:ring-green-500 focus:border-green-500 text-sm font-medium text-green-600"
                            disabled={loading}
                          />
                        </td>
                        <td className="px-2 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={item.kondisiRusak}
                            onChange={(e) => {
                              const newValue = parseInt(e.target.value) || 0
                              const updatedData = calculatedData.map(d =>
                                d.barangId === item.barangId
                                  ? {
                                    ...d,
                                    kondisiRusak: newValue,
                                    stokFisik: item.kondisiBaik + newValue + item.kondisiExpire
                                  }
                                  : d
                              )
                              setCalculatedData(updatedData)
                            }}
                            className="w-16 px-1 py-1 text-center border border-yellow-300 rounded focus:ring-yellow-500 focus:border-yellow-500 text-sm font-medium text-yellow-600"
                            disabled={loading}
                          />
                        </td>
                        <td className="px-2 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={item.kondisiExpire}
                            onChange={(e) => {
                              const newValue = parseInt(e.target.value) || 0
                              const updatedData = calculatedData.map(d =>
                                d.barangId === item.barangId
                                  ? {
                                    ...d,
                                    kondisiExpire: newValue,
                                    stokFisik: item.kondisiBaik + item.kondisiRusak + newValue
                                  }
                                  : d
                              )
                              setCalculatedData(updatedData)
                            }}
                            className="w-16 px-1 py-1 text-center border border-orange-300 rounded focus:ring-orange-500 focus:border-orange-500 text-sm font-medium text-orange-600"
                            disabled={loading}
                          />
                        </td>
                        <td className="px-2 py-3 text-center">
                          <div className="flex flex-col items-center">
                            <span className={`font-bold text-sm ${item.stokFisik !== item.stokSistem ? 'text-orange-600' : 'text-blue-600'
                              }`}>
                              {item.stokFisik}
                            </span>
                            {item.stokFisik !== item.stokSistem && (
                              <span className="text-xs text-orange-600 font-medium">
                                Selisih: {item.stokFisik - item.stokSistem}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col space-y-1">
                            {conditionBadge && (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${conditionBadge.color}`}>
                                {conditionBadge.text}
                              </span>
                            )}
                            {hasDiscrepancy && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                <FiAlertTriangle className="mr-1 h-3 w-3" />
                                Ada Selisih
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900 dark:text-white">
                            <div>{item.lokasiPenyimpanan || '-'}</div>
                            {item.nomorRak && (
                              <div className="text-xs text-gray-500">Rak {item.nomorRak}</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Total barang: {calculatedData.length} | Item dengan perbedaan: {itemsWithDiscrepancies.length}
                </div>
                <div className="text-sm">
                  <span className={`font-medium ${itemsWithDiscrepancies.length > 0 ? 'text-indigo-600' : 'text-green-600'}`}>
                    {itemsWithDiscrepancies.length > 0 ? `${itemsWithDiscrepancies.length} item perlu dicatat` : 'Tidak ada perbedaan'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!fetching && gudangId && calculatedData.length === 0 && (
          <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg shadow">
            <FiPackage className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Tidak ada barang di gudang ini
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {gudangId && !fetching && calculatedData.length > 0 && (
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                disabled={loading}
              >
                Batal
              </button>
            )}
            <button
              type="submit"
              disabled={loading || itemsWithDiscrepancies.length === 0}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Mencatat...' : `Catat Stock Opname (${itemsWithDiscrepancies.length} item dengan selisih)`}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
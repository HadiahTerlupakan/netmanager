'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  FiPackage,
  FiMapPin,
  FiAlertCircle,
  FiCheckCircle
} from 'react-icons/fi'

interface EnhancedOpnameFormProps {
  onClose?: () => void
  onSuccess?: () => void
  defaultGudangId?: string
}

interface GudangItem {
  id: string
  kode: string
  nama: string
  lokasi?: string
}

interface BarangItem {
  id: string
  kode: string
  nama: string
  satuan: string
  stockPerGudang: Array<{
    gudangId: string
    stok: number
  }>
}

interface OpnameData {
  stokFisik: string
  kondisiBaik: string
  kondisiRusak: string
  kondisiExpire: string
  lokasiPenyimpanan: string
  nomorRak: string
  nomorBox: string
  pic: string
  suhuPenyimpanan: string
  kelembaban: string
  tanggalExpire: string
  nomorBatch: string
  catatanDetail: string
}

export function EnhancedOpnameForm({ onClose, onSuccess, defaultGudangId }: EnhancedOpnameFormProps) {
  const [gudangId, setGudangId] = useState(defaultGudangId || '')
  const [gudangs, setGudangs] = useState<GudangItem[]>([])
  const [barangList, setBarangList] = useState<BarangItem[]>([])
  const [opnameData, setOpnameData] = useState<{ [key: string]: OpnameData }>({})
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  useEffect(() => {
    async function fetchGudangs() {
      try {
        const response = await fetch('/api/inventory/gudang')
        const data = await response.json()
        setGudangs(data.gudangs || [])
      } catch (error) {
        console.error('Error fetching gudangs:', error)
        setError('Gagal memuat data gudang')
      }
    }

    fetchGudangs()
  }, [])

  useEffect(() => {
    async function fetchBarangList() {
      if (gudangId) {
        setFetching(true)
        try {
          // Fetch from opname/calculate endpoint which has proper condition breakdown
          const response = await fetch(`/api/inventory/opname/calculate?gudangId=${gudangId}`)
          const data = await response.json()

          // Map the items to barangList format for display
          const barangs: BarangItem[] = data.items?.map((item: {
            barangId: string;
            barangKode: string;
            barangNama: string;
            barangSatuan: string;
            gudangId: string;
            stokSistem: number;
          }) => ({
            id: item.barangId,
            kode: item.barangKode,
            nama: item.barangNama,
            satuan: item.barangSatuan,
            stockPerGudang: [{
              gudangId: item.gudangId,
              stok: item.stokSistem
            }]
          })) || []

          setBarangList(barangs)

          // Initialize opnameData with actual condition breakdown from API
          const initialData: { [key: string]: OpnameData } = {}
          data.items?.forEach((item: {
            barangId: string;
            stokSistem?: number;
            kondisiBaik?: number;
            kondisiRusak?: number;
            kondisiExpire?: number;
            lokasiPenyimpanan?: string;
            nomorRak?: string;
            nomorBox?: string;
            pic?: string;
            suhuPenyimpanan?: number;
            kelembaban?: number;
            tanggalExpire?: string;
            nomorBatch?: string;
            catatanDetail?: string;
          }) => {
            initialData[item.barangId] = {
              stokFisik: item.stokSistem?.toString() || '0',
              kondisiBaik: item.kondisiBaik?.toString() || '0', // Use actual breakdown from API
              kondisiRusak: item.kondisiRusak?.toString() || '0', // Use actual breakdown from API
              kondisiExpire: item.kondisiExpire?.toString() || '0',
              lokasiPenyimpanan: item.lokasiPenyimpanan || '',
              nomorRak: item.nomorRak || '',
              nomorBox: item.nomorBox || '',
              pic: item.pic || '',
              suhuPenyimpanan: item.suhuPenyimpanan?.toString() || '',
              kelembaban: item.kelembaban?.toString() || '',
              tanggalExpire: item.tanggalExpire || '',
              nomorBatch: item.nomorBatch || '',
              catatanDetail: item.catatanDetail || ''
            }
          })
          setOpnameData(initialData)
        } catch (error) {
          console.error('Error fetching barang list:', error)
          setError('Gagal memuat daftar barang')
        } finally {
          setFetching(false)
        }
      }
    }

    fetchBarangList()
  }, [gudangId])

  const handleOpnameChange = (barangId: string, field: keyof OpnameData, value: string) => {
    const defaultOpnameData: OpnameData = {
      stokFisik: '0',
      kondisiBaik: '0',
      kondisiRusak: '0',
      kondisiExpire: '0',
      lokasiPenyimpanan: '',
      nomorRak: '',
      nomorBox: '',
      pic: '',
      suhuPenyimpanan: '',
      kelembaban: '',
      tanggalExpire: '',
      nomorBatch: '',
      catatanDetail: ''
    }
    
    setOpnameData(prev => ({
      ...prev,
      [barangId]: {
        ...(prev[barangId] ?? defaultOpnameData),
        [field]: value
      }
    }))

    // Auto-calculate stokFisik when kondisi fields change
    if (field === 'kondisiBaik' || field === 'kondisiRusak' || field === 'kondisiExpire') {
      const data = opnameData[barangId]
      if (data) {
        const total = parseInt(value || '0') +
          parseInt(field === 'kondisiBaik' ? '0' : data.kondisiBaik || '0') +
          parseInt(field === 'kondisiRusak' ? '0' : data.kondisiRusak || '0') +
          parseInt(field === 'kondisiExpire' ? '0' : data.kondisiExpire || '0')

        setOpnameData(prev => ({
          ...prev,
          [barangId]: {
            ...prev[barangId]!,
            stokFisik: total.toString()
          }
        }))
      }
    }
  }

  const validateOpnameData = (barangId: string): string[] => {
    const data = opnameData[barangId]
    const errors: string[] = []

    if (!data) return errors

    const stokFisik = parseInt(data.stokFisik || '0')
    const kondisiBaik = parseInt(data.kondisiBaik || '0')
    const kondisiRusak = parseInt(data.kondisiRusak || '0')
    const kondisiExpire = parseInt(data.kondisiExpire || '0')

    // Validate total condition matches physical stock
    const totalKondisi = kondisiBaik + kondisiRusak + kondisiExpire
    if (totalKondisi !== stokFisik) {
      errors.push(`Total kondisi (${totalKondisi}) harus sama dengan stok fisik (${stokFisik})`)
    }

    // Validate temperature if provided
    if (data.suhuPenyimpanan && parseFloat(data.suhuPenyimpanan) < -50) {
      errors.push('Suhu penyimpanan tidak realistis')
    }

    // Validate humidity if provided
    if (data.kelembaban && (parseFloat(data.kelembaban) < 0 || parseFloat(data.kelembaban) > 100)) {
      errors.push('Kelembaban harus antara 0-100%')
    }

    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!gudangId) {
      setError('Pilih gudang terlebih dahulu')
      return
    }

    // Validate all data
    const validationErrors: string[] = []
    Object.keys(opnameData).forEach(barangId => {
      const errors = validateOpnameData(barangId)
      if (errors.length > 0) {
        const barang = barangList.find(b => b.id === barangId)
        validationErrors.push(`${barang?.kode}: ${errors.join(', ')}`)
      }
    })

    if (validationErrors.length > 0) {
      setError(validationErrors.join('; '))
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const promises = Object.entries(opnameData).map(async ([barangId, data]) => {
        const jumlah = parseInt(data.stokFisik || '0')
        if (isNaN(jumlah) || jumlah < 0) return null

        const response = await fetch('/api/inventory/opname', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            barangId,
            gudangId,
            stokFisik: jumlah,
            keterangan: `Stock Opname ${new Date().toLocaleDateString('id-ID')} - ${data.catatanDetail || 'Tidak ada catatan'}`,
            kondisiBaik: parseInt(data.kondisiBaik || '0'),
            kondisiRusak: parseInt(data.kondisiRusak || '0'),
            kondisiExpire: parseInt(data.kondisiExpire || '0'),
            lokasiPenyimpanan: data.lokasiPenyimpanan || undefined,
            nomorRak: data.nomorRak || undefined,
            nomorBox: data.nomorBox || undefined,
            pic: data.pic || undefined,
            suhuPenyimpanan: data.suhuPenyimpanan ? parseFloat(data.suhuPenyimpanan) : undefined,
            kelembaban: data.kelembaban ? parseFloat(data.kelembaban) : undefined,
            tanggalExpire: data.tanggalExpire || undefined,
            nomorBatch: data.nomorBatch || undefined,
            catatanDetail: data.catatanDetail || undefined
          }),
        })

        if (!response.ok) {
          const responseData = await response.json()
          throw new Error(responseData.error || 'Gagal mencatat stock opname')
        }

        return response.json()
      })

      await Promise.all(promises)

      setSuccess('Stock opname berhasil dicatat untuk semua barang!')

      if (onSuccess) {
        setTimeout(() => {
          onSuccess()
        }, 1500)
      } else {
        setTimeout(() => {
          router.push('/admin/inventory')
        }, 2000)
      }

    } catch (error) {
      console.error('Error submitting stock opname:', error)
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const selectedGudang = gudangs.find(g => g.id === gudangId)
  const hasChanges = barangList.some(barang => {
    const currentStok = barang.stockPerGudang?.find((s: { gudangId: string; stok: number }) => s.gudangId === gudangId)?.stok || 0
    const newStok = parseInt(opnameData[barang.id]?.stokFisik || '0')
    return currentStok !== newStok
  })

  const _getConditionSummary = (barangId: string) => {
    const data = opnameData[barangId]
    if (!data) return null

    const baik = parseInt(data.kondisiBaik || '0')
    const rusak = parseInt(data.kondisiRusak || '0')
    const expire = parseInt(data.kondisiExpire || '0')
    const total = baik + rusak + expire

    if (total === 0) return null

    const persentaseBaik = (baik / total) * 100
    const persentaseRusak = (rusak / total) * 100
    const persentaseExpire = (expire / total) * 100

    return { baik, rusak, expire, total, persentaseBaik, persentaseRusak, persentaseExpire }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 flex items-start">
            <FiAlertCircle className="mt-0.5 mr-2 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-800 flex items-center">
            <FiCheckCircle className="mr-2 shrink-0" />
            <div>{success}</div>
          </div>
        )}

        {/* Gudang Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="mb-4">
            <label htmlFor="gudangId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FiMapPin className="inline mr-2" />
              Pilih Gudang *
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
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Gudang Terpilih:
              </p>
              <p className="mt-1 text-gray-900 dark:text-white">
                {selectedGudang.kode} - {selectedGudang.nama}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Lokasi: {selectedGudang.lokasi || '-'}
              </p>
            </div>
          )}
        </div>

        {/* Barang List */}
        {fetching && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Memuat daftar barang...</p>
          </div>
        )}

        {!fetching && gudangId && barangList.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Stock Opname Detail - {selectedGudang?.nama}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Masukkan stok fisik dan kondisi barang yang dihitung
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
                      Baru
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Rusak
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Bekas
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Total Fisik
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Lokasi
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      PIC
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {barangList.map((barang) => {
                    const data: OpnameData | undefined = opnameData[barang.id]
                    const currentStok = barang.stockPerGudang?.find((s: { gudangId: string; stok: number }) => s.gudangId === gudangId)?.stok || 0
                    const newStok = parseInt(data?.stokFisik || '0')
                    const diff = newStok - currentStok

                    return (
                      <tr key={barang.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {barang.kode}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {barang.nama}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${currentStok === 0 ? 'bg-red-100 text-red-800' :
                            currentStok < 5 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                            {currentStok}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <input
                            type="number"
                            value={data?.kondisiBaik || ''}
                            onChange={(e) => handleOpnameChange(barang.id, 'kondisiBaik', e.target.value)}
                            className="w-16 px-1 py-1 text-center border border-gray-300 rounded text-sm focus:outline-none focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            min="0"
                            disabled={loading}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <input
                            type="number"
                            value={data?.kondisiRusak || ''}
                            onChange={(e) => handleOpnameChange(barang.id, 'kondisiRusak', e.target.value)}
                            className="w-16 px-1 py-1 text-center border border-gray-300 rounded text-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            min="0"
                            disabled={loading}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <input
                            type="number"
                            value={data?.kondisiExpire || ''}
                            onChange={(e) => handleOpnameChange(barang.id, 'kondisiExpire', e.target.value)}
                            className="w-16 px-1 py-1 text-center border border-gray-300 rounded text-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            min="0"
                            disabled={loading}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-3 text-center">
                          <div className="flex flex-col items-center space-y-1">
                            <span className={`font-bold text-sm ${newStok > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              {newStok}
                            </span>
                            {diff !== 0 && (
                              <span className={`text-xs ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {diff > 0 ? '+' : ''}{diff}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={data?.nomorRak || ''}
                            onChange={(e) => handleOpnameChange(barang.id, 'nomorRak', e.target.value)}
                            className="w-20 px-1 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="Rak"
                            disabled={loading}
                          />
                        </td>
                        <td className="px-2 py-3 text-center">
                          <input
                            type="text"
                            value={data?.pic || ''}
                            onChange={(e) => handleOpnameChange(barang.id, 'pic', e.target.value)}
                            className="w-20 px-1 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="PIC"
                            disabled={loading}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Total barang: {barangList.length}
                </div>
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Perubahan: </span>
                  <span className={`font-medium ${hasChanges ? 'text-indigo-600' : 'text-green-600'}`}>
                    {hasChanges ? 'Ada perubahan' : 'Tidak ada perubahan'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!fetching && gudangId && barangList.length === 0 && (
          <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg shadow">
            <FiPackage className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Tidak ada barang di gudang ini
            </p>
          </div>
        )}

        {/* Submit Button */}
        {gudangId && !fetching && barangList.length > 0 && (
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
              disabled={loading || !hasChanges}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Menyimpan...' : 'Simpan Stock Opname'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
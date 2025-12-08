'use client'

import { useState, useEffect } from 'react'
import { FiPackage, FiMapPin, FiAlertTriangle, FiCheckCircle, FiDownload, FiRefreshCw } from 'react-icons/fi'

interface StockItem {
    barangId: string
    barangKode: string
    barangNama: string
    barangSatuan: string
    stokTotal: number
    stokBaru: number
    stokBekas: number
    stokRusak: number
    totalHilang: number
}

interface GudangStock {
    gudangId: string
    gudangKode: string
    gudangNama: string
    gudangLokasi: string | null
    totalBarang: number
    totalStok: number
    totalHilang: number
    items: StockItem[]
}

interface GudangOption {
    id: string
    kode: string
    nama: string
}

export function StockReport() {
    const [gudangOptions, setGudangOptions] = useState<GudangOption[]>([])
    const [selectedGudangId, setSelectedGudangId] = useState<string>('')
    const [gudangData, setGudangData] = useState<GudangStock | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Fetch list of gudangs first
    useEffect(() => {
        fetchGudangList()
    }, [])

    // Fetch stock data when gudang is selected
    useEffect(() => {
        if (selectedGudangId) {
            fetchStockReport(selectedGudangId)
        }
    }, [selectedGudangId])

    async function fetchGudangList() {
        try {
            const response = await fetch('/api/inventory/gudang')
            if (!response.ok) throw new Error('Gagal memuat daftar gudang')
            const data = await response.json()
            // API returns { gudangs: [...] }
            const gudangs = Array.isArray(data.gudangs) ? data.gudangs : []
            setGudangOptions(gudangs)
            // Don't auto-select, let user choose first
            setLoading(false)
        } catch (error) {
            console.error('Error fetching gudang list:', error)
            setError('Gagal memuat daftar gudang')
            setLoading(false)
        }
    }

    async function fetchStockReport(gudangId: string) {
        setLoading(true)
        setError('')

        try {
            const response = await fetch(`/api/inventory/opname/report?gudangId=${gudangId}`)
            if (!response.ok) throw new Error('Gagal memuat laporan stok')

            const data = await response.json()
            if (data.gudangList && data.gudangList.length > 0) {
                setGudangData(data.gudangList[0])
            } else {
                setGudangData(null)
            }
        } catch (error) {
            console.error('Error fetching stock report:', error)
            setError(error instanceof Error ? error.message : 'Terjadi kesalahan')
        } finally {
            setLoading(false)
        }
    }

    const handleExportCSV = () => {
        if (!gudangData) return

        const headers = ['Kode Barang', 'Nama Barang', 'Satuan', 'Stok Total', 'Baru', 'Bekas', 'Rusak', 'Hilang']
        const rows = gudangData.items.map(item => [
            item.barangKode,
            item.barangNama,
            item.barangSatuan,
            item.stokTotal.toString(),
            item.stokBaru.toString(),
            item.stokBekas.toString(),
            item.stokRusak.toString(),
            item.totalHilang.toString()
        ])

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `laporan_stok_${gudangData.gudangKode}_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
    }

    const selectedGudang = gudangOptions.find(g => g.id === selectedGudangId)

    return (
        <div className="space-y-6">
            {/* Gudang Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            Laporan Stok Gudang
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Pilih gudang untuk melihat laporan stok
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={selectedGudangId}
                            onChange={(e) => setSelectedGudangId(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                            <option value="">-- Pilih Gudang --</option>
                            {gudangOptions.map(gudang => (
                                <option key={gudang.id} value={gudang.id}>
                                    {gudang.kode} - {gudang.nama}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => selectedGudangId && fetchStockReport(selectedGudangId)}
                            disabled={!selectedGudangId || loading}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                        >
                            <FiRefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading/Error States */}
            {loading && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Memuat data...</p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                    {error}
                </div>
            )}

            {/* Gudang Report */}
            {!loading && !error && gudangData && (
                <>
                    {/* Gudang Info & Summary Cards */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow p-6 text-white">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-white/20 rounded-lg">
                                <FiMapPin className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">{gudangData.gudangKode} - {gudangData.gudangNama}</h3>
                                <p className="text-blue-100">{gudangData.gudangLokasi || 'Lokasi tidak diset'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-white/10 rounded-lg p-4">
                                <p className="text-blue-100 text-sm">Jenis Barang</p>
                                <p className="text-2xl font-bold">{gudangData.totalBarang}</p>
                            </div>
                            <div className="bg-white/10 rounded-lg p-4">
                                <p className="text-blue-100 text-sm">Total Stok</p>
                                <p className="text-2xl font-bold">{gudangData.totalStok}</p>
                            </div>
                            <div className="bg-white/10 rounded-lg p-4">
                                <p className="text-blue-100 text-sm">Stok Baik</p>
                                <p className="text-2xl font-bold text-green-300">
                                    {gudangData.items.reduce((sum, i) => sum + i.stokBaru + i.stokBekas, 0)}
                                </p>
                            </div>
                            <div className="bg-white/10 rounded-lg p-4">
                                <p className="text-blue-100 text-sm">🔴 Barang Rusak</p>
                                <p className="text-2xl font-bold text-red-300">
                                    {gudangData.items.reduce((sum, i) => sum + i.stokRusak, 0)}
                                </p>
                            </div>
                            <div className="bg-white/10 rounded-lg p-4">
                                <p className="text-blue-100 text-sm">🟣 Barang Hilang</p>
                                <p className="text-2xl font-bold text-purple-300">{gudangData.totalHilang}</p>
                            </div>
                        </div>
                    </div>

                    {/* Export Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={handleExportCSV}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                        >
                            <FiDownload className="h-4 w-4 mr-2" />
                            Export CSV
                        </button>
                    </div>

                    {/* Items Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Daftar Barang di {gudangData.gudangNama}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {gudangData.items.length} jenis barang
                            </p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kode</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Barang</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stok Total</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-green-600 uppercase">🟢 Baru</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-yellow-600 uppercase">🟡 Bekas</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-red-600 uppercase">🔴 Rusak</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-purple-600 uppercase">🟣 Hilang</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {gudangData.items.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                                Tidak ada barang di gudang ini
                                            </td>
                                        </tr>
                                    ) : (
                                        gudangData.items.map(item => (
                                            <tr key={item.barangId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                                    {item.barangKode}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                                    {item.barangNama}
                                                    <span className="ml-2 text-xs text-gray-400">({item.barangSatuan})</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="font-bold text-gray-900 dark:text-white text-lg">{item.stokTotal}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                                        {item.stokBaru}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                                                        {item.stokBekas}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                                                        {item.stokRusak}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {item.totalHilang > 0 ? (
                                                        <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                                                            {item.totalHilang}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary Footer */}
                        {gudangData.items.length > 0 && (
                            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">Total</span>
                                    <div className="flex gap-6">
                                        <span className="font-bold text-gray-900 dark:text-white">
                                            Stok: {gudangData.totalStok}
                                        </span>
                                        <span className="text-green-600 font-medium">
                                            Baru: {gudangData.items.reduce((sum, i) => sum + i.stokBaru, 0)}
                                        </span>
                                        <span className="text-yellow-600 font-medium">
                                            Bekas: {gudangData.items.reduce((sum, i) => sum + i.stokBekas, 0)}
                                        </span>
                                        <span className="text-red-600 font-medium">
                                            Rusak: {gudangData.items.reduce((sum, i) => sum + i.stokRusak, 0)}
                                        </span>
                                        <span className="text-purple-600 font-medium">
                                            🟣 Hilang: {gudangData.totalHilang}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* No Gudang Selected */}
            {!loading && !error && !gudangData && selectedGudangId && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
                    Tidak ada data untuk gudang ini
                </div>
            )}

            {!loading && !error && !selectedGudangId && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
                    <FiMapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Pilih gudang untuk melihat laporan stok</p>
                </div>
            )}
        </div>
    )
}

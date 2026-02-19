'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiUser, FiMapPin, FiCalendar, FiDollarSign } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'

interface DepreciationLog {
    id: string
    date: string
    amount: number | string
    notes?: string
}

interface Asset {
    id: string
    kodeAsset: string
    status: string
    currentValue: number | string
    purchasePrice: number | string
    usefulLife: number
    purchaseDate: string
    location?: string
    residualValue: number | string
    assignedTo?: string
    barang: {
        nama: string
    }
    depreciationLogs?: DepreciationLog[]
}

interface AssetDetailProps {
    asset: Asset
}

export function AssetDetailView({ asset: initialAsset }: AssetDetailProps) {
    const router = useRouter()
    const [asset, setAsset] = useState(initialAsset)
    const [loading, setLoading] = useState(false)

    const handleDepreciate = async () => {
        if (!confirm('Jalankan penyusutan untuk periode ini?')) return
        setLoading(true)
        try {
            const res = await fetch(`/api/inventory/assets/${asset.id}/depreciate`, {
                method: 'POST'
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal memproses penyusutan')
            
            if (data.message) alert(data.message)
            else alert('Penyusutan berhasil dicatat.')
            
            // Refresh data
            router.refresh()
            // Or fetch updated
            const updated = await fetch(`/api/inventory/assets/${asset.id}`).then(r => r.json())
            setAsset(updated.asset)
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Gagal memproses penyusutan')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header Info */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                             <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                asset.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                                {asset.status}
                            </span>
                            <span className="text-sm text-gray-500">{asset.kodeAsset}</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                            {asset.barang.nama}
                        </h1>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleDepreciate}
                            disabled={loading || asset.status !== 'ACTIVE' || Number(asset.currentValue) <= Number(asset.residualValue)}
                            
                        >
                            Hitung Penyusutan
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-2 mb-1 text-gray-500 dark:text-gray-400">
                             <FiDollarSign /> <span className="text-sm">Nilai Buku Saat Ini</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                            {formatCurrency(Number(asset.currentValue))}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            Dari Harga Beli: {formatCurrency(Number(asset.purchasePrice))}
                        </p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                         <div className="flex items-center gap-2 mb-1 text-gray-500 dark:text-gray-400">
                             <FiCalendar /> <span className="text-sm">Umur Ekonomis</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                            {asset.usefulLife} Bulan
                        </p>
                         <p className="text-xs text-gray-500 mt-1">
                            Beli: {new Date(asset.purchaseDate).toLocaleDateString()}
                        </p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                         <div className="flex items-center gap-2 mb-1 text-gray-500 dark:text-gray-400">
                             <FiMapPin /> <span className="text-sm">Lokasi</span>
                        </div>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">
                            {asset.location || '-'}
                        </p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                         <div className="flex items-center gap-2 mb-1 text-gray-500 dark:text-gray-400">
                             <FiUser /> <span className="text-sm">Penanggung Jawab</span>
                        </div>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">
                            {asset.assignedTo || '-'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Depreciation History */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Riwayat Penyusutan</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tanggal</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Keterangan</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Jumlah (IDR)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {(!asset.depreciationLogs || asset.depreciationLogs.length === 0) ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">Belum ada riwayat penyusutan</td>
                                </tr>
                            ) : (
                                asset.depreciationLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {new Date(log.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {log.notes}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600 dark:text-red-400">
                                            -{formatCurrency(Number(log.amount))}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

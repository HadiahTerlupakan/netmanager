"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiOutlineArrowLeft,
    HiOutlineCheckCircle,
    HiOutlineSparkles,
} from 'react-icons/hi2'

export default function GenerateTagihanPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState<'current' | 'custom'>('current')
    const [periodeBulan, setPeriodeBulan] = useState(new Date().getMonth() + 1)
    const [periodeTahun, setPeriodeTahun] = useState(new Date().getFullYear())
    const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)

    const handleGenerate = async () => {
        if (!confirm(`Generate tagihan untuk ${getMonthName(periodeBulan)} ${periodeTahun}?`)) {
            return
        }

        try {
            setLoading(true)
            setResult(null)

            const response = await fetch('/api/tagihan/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    periodeBulan,
                    periodeTahun,
                }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to generate tagihan')
            }

            const data = await response.json()
            setResult(data)
        } catch (error: any) {
            alert(error.message || 'Gagal generate tagihan')
        } finally {
            setLoading(false)
        }
    }

    const getMonthName = (month: number) => {
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ]
        return months[month - 1]
    }

    return (
        <div className="p-6 space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/admin/finance/tagihan"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <HiOutlineArrowLeft className="w-6 h-6 text-gray-600" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">Generate Tagihan</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Generate tagihan bulanan untuk pelanggan aktif
                    </p>
                </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="space-y-6">
                    {/* Mode Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Pilih Periode
                        </label>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setMode('current')}
                                className={`flex-1 p-4 rounded-lg border-2 transition-colors ${mode === 'current'
                                        ? 'border-sky-500 bg-sky-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">Bulan Berjalan</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {getMonthName(new Date().getMonth() + 1)} {new Date().getFullYear()}
                                    </p>
                                </div>
                            </button>
                            <button
                                onClick={() => setMode('custom')}
                                className={`flex-1 p-4 rounded-lg border-2 transition-colors ${mode === 'custom'
                                        ? 'border-sky-500 bg-sky-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">Custom</p>
                                    <p className="text-sm text-gray-500 mt-1">Pilih periode sendiri</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Custom Period */}
                    {mode === 'custom' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Bulan
                                </label>
                                <select
                                    value={periodeBulan}
                                    onChange={(e) => setPeriodeBulan(parseInt(e.target.value))}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                        <option key={month} value={month}>
                                            {getMonthName(month)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Tahun
                                </label>
                                <input
                                    type="number"
                                    value={periodeTahun}
                                    onChange={(e) => setPeriodeTahun(parseInt(e.target.value))}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                    min={2020}
                                    max={2030}
                                />
                            </div>
                        </div>
                    )}

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                            <strong>Catatan:</strong> Sistem akan generate tagihan untuk semua pelanggan REGULER yang aktif.
                            Pelanggan NON_REGULER tidak akan di-generate otomatis (hanya manual atau saat renewal).
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <HiOutlineSparkles className="w-5 h-5" />
                                    Generate Tagihan
                                </>
                            )}
                        </button>
                        <Link
                            href="/admin/finance/tagihan"
                            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-center"
                        >
                            Batal
                        </Link>
                    </div>
                </div>
            </div>

            {/* Result */}
            {result && (
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <HiOutlineCheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Generate Selesai</h3>
                            <p className="text-sm text-gray-500">
                                Berhasil: {result.success} | Gagal: {result.failed}
                            </p>
                        </div>
                    </div>

                    {result.errors.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <p className="text-sm font-medium text-red-600 mb-2">Error:</p>
                            <ul className="space-y-1">
                                {result.errors.map((error, index) => (
                                    <li key={index} className="text-sm text-red-600">
                                        • {error}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="mt-4 flex gap-3">
                        <Link
                            href="/admin/finance/tagihan"
                            className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
                        >
                            Lihat Daftar Tagihan
                        </Link>
                        <button
                            onClick={() => {
                                setResult(null)
                                setMode('current')
                                setPeriodeBulan(new Date().getMonth() + 1)
                                setPeriodeTahun(new Date().getFullYear())
                            }}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Generate Lagi
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

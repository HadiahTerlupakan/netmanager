"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiArrowPath,
    HiOutlineDocumentText,
    HiBars3,
    HiOutlineCheck,
} from 'react-icons/hi2'
import { useFinance } from '@/hooks/useFinance'
import PageLoader from '@/components/ui/PageLoader'

const TAX_TYPES = [
    { value: 'PPN_IN', label: 'PPN Masukan' },
    { value: 'PPN_OUT', label: 'PPN Keluaran' },
    { value: 'PPH_21', label: 'PPh 21 - Karyawan' },
    { value: 'PPH_23', label: 'PPh 23 - Jasa' },
    { value: 'PPH_25', label: 'PPh 25 - Angsuran' },
    { value: 'PPH_29', label: 'PPh 29 - Akhir Tahun' },
]

const MONTHS = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
]

export default function NewTaxRecordPage() {
    const router = useRouter()
    const { data: financeUser, loading: userLoading } = useFinance()
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const currentDate = new Date()
    const [formData, setFormData] = useState({
        taxType: 'PPN_OUT',
        taxPeriod: currentDate.getMonth() + 1,
        taxYear: currentDate.getFullYear(),
        taxableAmount: '',
        reference: '',
        notes: '',
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSubmitting(true)

        try {
            const token = localStorage.getItem('finance_token')

            const response = await fetch('/api/finance/tax/records', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'x-finance-token': token } : {}),
                },
                body: JSON.stringify({
                    ...formData,
                    taxableAmount: formData.taxableAmount.replace(/\D/g, ''), // Remove non-numeric
                    createdBy: financeUser?.id || 'admin',
                }),
            })

            if (response.ok) {
                router.push('/finance/tax/records')
            } else {
                const data = await response.json()
                setError(data.error || 'Gagal menyimpan catatan pajak')
            }
        } catch (err) {
            console.error('Error creating tax record:', err)
            setError('Terjadi kesalahan saat menyimpan')
        } finally {
            setSubmitting(false)
        }
    }

    const formatNumber = (value: string) => {
        const num = value.replace(/\D/g, '')
        return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    }

    if (userLoading) {
        return <PageLoader />
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
            {/* Header */}
            <header className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    if ((window as any).toggleFinanceSidebar) {
                                        (window as any).toggleFinanceSidebar()
                                    }
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden"
                            >
                                <HiBars3 className="w-6 h-6" />
                            </button>
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                <HiOutlineDocumentText className="w-6 h-6" />
                            </div>
                            <h1 className="text-xl font-bold">Tambah Catatan Pajak</h1>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="px-4 py-4 md:px-6 lg:px-8 max-w-2xl mx-auto">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Tax Type */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Jenis Pajak
                        </h3>
                        <select
                            value={formData.taxType}
                            onChange={(e) => setFormData({ ...formData, taxType: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            required
                        >
                            {TAX_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Period */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Periode Pajak
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Bulan
                                </label>
                                <select
                                    value={formData.taxPeriod}
                                    onChange={(e) => setFormData({ ...formData, taxPeriod: parseInt(e.target.value) })}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    required
                                >
                                    {MONTHS.map((month) => (
                                        <option key={month.value} value={month.value}>
                                            {month.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Tahun
                                </label>
                                <select
                                    value={formData.taxYear}
                                    onChange={(e) => setFormData({ ...formData, taxYear: parseInt(e.target.value) })}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    required
                                >
                                    {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map((year) => (
                                        <option key={year} value={year}>
                                            {year}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Jumlah
                        </h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Dasar Pengenaan Pajak (DPP)
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                                    Rp
                                </span>
                                <input
                                    type="text"
                                    value={formatNumber(formData.taxableAmount)}
                                    onChange={(e) => setFormData({ ...formData, taxableAmount: e.target.value.replace(/\D/g, '') })}
                                    className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right"
                                    placeholder="0"
                                    required
                                />
                            </div>
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Pajak akan dihitung otomatis berdasarkan tarif yang berlaku
                            </p>
                        </div>
                    </div>

                    {/* Optional Fields */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Informasi Tambahan (Opsional)
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Referensi / No. Faktur
                                </label>
                                <input
                                    type="text"
                                    value={formData.reference}
                                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder="e.g., FP-001234"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Catatan
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder="Catatan tambahan..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <Link
                            href="/finance/tax/records"
                            className="flex-1 px-6 py-3 text-center border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Batal
                        </Link>
                        <button
                            type="submit"
                            disabled={submitting || !formData.taxableAmount}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                            {submitting ? (
                                <HiArrowPath className="w-5 h-5 animate-spin" />
                            ) : (
                                <HiOutlineCheck className="w-5 h-5" />
                            )}
                            Simpan
                        </button>
                    </div>
                </form>

                {/* Back Link */}
                <div className="mt-6">
                    <Link
                        href="/finance/tax"
                        className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                        ← Back to Tax Dashboard
                    </Link>
                </div>
            </main>
        </div>
    )
}

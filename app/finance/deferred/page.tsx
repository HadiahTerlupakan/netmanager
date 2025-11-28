"use client"

import { useEffect, useState } from 'react'
import { HiArrowPath, HiCurrencyDollar, HiCalendar, HiCheckCircle } from 'react-icons/hi2'

interface DeferredRevenue {
    id: string
    tagihanId?: string
    customerId?: string
    totalAmount: string
    recognizedAmount: string
    remainingAmount: string
    periodMonths: number
    monthlyAmount: string
    status: string
    startDate: string
    endDate: string
    description?: string
}

const formatRupiah = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num)
}

export default function DeferredRevenuePage() {
    const [loading, setLoading] = useState(true)
    const [deferrals, setDeferrals] = useState<DeferredRevenue[]>([])
    const [totals, setTotals] = useState({ deferred: 0, recognized: 0, remaining: 0 })

    useEffect(() => {
        fetchDeferrals()
    }, [])

    const fetchDeferrals = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/finance/deferred?status=ACTIVE')
            if (response.ok) {
                const data = await response.json()
                setDeferrals(data)

                // Calculate totals
                const total = data.reduce((sum: number, d: DeferredRevenue) => sum + parseFloat(d.totalAmount), 0)
                const recognized = data.reduce((sum: number, d: DeferredRevenue) => sum + parseFloat(d.recognizedAmount), 0)
                const remaining = data.reduce((sum: number, d: DeferredRevenue) => sum + parseFloat(d.remainingAmount), 0)

                setTotals({ deferred: total, recognized, remaining })
            }
        } catch (error) {
            console.error('Error fetching deferrals:', error)
        } finally {
            setLoading(false)
        }
    }

    const recognizeThisMonth = async () => {
        try {
            const response = await fetch('/api/finance/deferred/recognize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    month: new Date().toISOString(),
                    recognizedBy: 'admin', // TODO: get from auth
                }),
            })

            if (response.ok) {
                const result = await response.json()
                alert(`Recognized ${result.recognized} deferrals successfully!`)
                await fetchDeferrals()
            }
        } catch (error) {
            console.error('Error recognizing revenue:', error)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <HiArrowPath className="h-8 w-8 text-emerald-600 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Deferred Revenue</h1>
                <p className="text-sm text-gray-600">
                    Subscription Revenue Recognition - Recognized Monthly
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Deferred</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {formatRupiah(totals.deferred)}
                            </p>
                        </div>
                        <HiCurrencyDollar className="h-12 w-12 text-gray-400" />
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Already Recognized</p>
                            <p className="text-2xl font-bold text-green-600 mt-1">
                                {formatRupiah(totals.recognized)}
                            </p>
                        </div>
                        <HiCheckCircle className="h-12 w-12 text-green-400" />
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Remaining Balance</p>
                            <p className="text-2xl font-bold text-blue-600 mt-1">
                                {formatRupiah(totals.remaining)}
                            </p>
                        </div>
                        <HiCalendar className="h-12 w-12 text-blue-400" />
                    </div>
                </div>
            </div>

            {/* Action Button */}
            <div className="mb-6">
                <button
                    onClick={recognizeThisMonth}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                >
                    <HiCheckCircle className="h-5 w-5" />
                    Recognize This Month
                </button>
            </div>

            {/* Deferrals Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Active Deferrals</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Description
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Total Amount
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Monthly
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    Period
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Recognized
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Remaining
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    Progress
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {deferrals.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                        No active deferred revenues
                                    </td>
                                </tr>
                            ) : (
                                deferrals.map((d) => {
                                    const progress = (parseFloat(d.recognizedAmount) / parseFloat(d.totalAmount)) * 100
                                    return (
                                        <tr key={d.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm text-gray-900">
                                                {d.description || `Tagihan ${d.tagihanId}`}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-right text-gray-900">
                                                {formatRupiah(d.totalAmount)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-right text-emerald-600 font-medium">
                                                {formatRupiah(d.monthlyAmount)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-center text-gray-600">
                                                {d.periodMonths} months
                                            </td>
                                            <td className="px-6 py-4 text-sm text-right text-green-600">
                                                {formatRupiah(d.recognizedAmount)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-right text-blue-600">
                                                {formatRupiah(d.remainingAmount)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                                                        <div
                                                            className="bg-emerald-600 h-2 rounded-full"
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-600">{Math.round(progress)}%</span>
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

            {/* Info Box */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    Tentang Deferred Revenue
                </h4>
                <p className="text-sm text-blue-800">
                    Deferred revenue adalah pendapatan yang dibayar di muka oleh pelanggan (misal langganan tahunan)
                    tapi diakui secara bertahap setiap bulan. Sistem akan otomatis recognize revenue sesuai periode
                    subscription. Klik "Recognize This Month" untuk recognize pendapatan bulan ini secara manual.
                </p>
            </div>
        </div>
    )
}

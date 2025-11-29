'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    HiOutlinePlus,
    HiOutlineEye,
    HiOutlineCheckCircle,
    HiOutlineBanknotes
} from 'react-icons/hi2'

interface Payroll {
    id: string
    month: number
    year: number
    periodStart: string
    periodEnd: string
    totalGross: string
    totalDeduction: string
    totalNet: string
    totalEmployees: number
    status: string
    processedAt: string | null
    approvedAt: string | null
    paidAt: string | null
    _count: {
        payrollDetails: number
    }
}

export default function PayrollPage() {
    const [payrolls, setPayrolls] = useState<Payroll[]>([])
    const [loading, setLoading] = useState(true)
    const [showProcessForm, setShowProcessForm] = useState(false)
    const [formData, setFormData] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
    })
    const [processing, setProcessing] = useState(false)

    useEffect(() => {
        fetchPayrolls()
    }, [])

    const fetchPayrolls = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/hris/payroll')
            const data = await res.json()
            if (res.ok) {
                setPayrolls(data.payrolls || [])
            }
        } catch (error) {
            console.error('Error fetching payrolls:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleProcess = async (e: React.FormEvent) => {
        e.preventDefault()
        setProcessing(true)

        try {
            const res = await fetch('/api/hris/payroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            const data = await res.json()

            if (res.ok) {
                alert(`✅ ${data.message}\n\nPayroll calculated successfully!`)
                setShowProcessForm(false)
                fetchPayrolls()
            } else {
                alert(`❌ Error: ${data.error}`)
            }
        } catch (error) {
            console.error('Error processing payroll:', error)
            alert('Failed to process payroll')
        } finally {
            setProcessing(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
            CALCULATED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            PAID: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
        }

        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100'}`}>
                {status}
            </span>
        )
    }

    const formatCurrency = (amount: string) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(Number(amount))
    }

    const getMonthName = (month: number) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return months[month - 1]
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payroll Management</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Process monthly payroll and manage salary payments
                    </p>
                </div>
                <button
                    onClick={() => setShowProcessForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                    <HiOutlinePlus className="w-5 h-5" />
                    Process Payroll
                </button>
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    💡 Payroll Integration
                </h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Process: Calculate → Approve → Mark as Paid</li>
                    <li>• Auto-deducts attendance penalties and adds overtime pay</li>
                    <li>• <strong>When marked as PAID</strong>: Automatically creates Pengeluaran entry in Finance module</li>
                    <li>• Category: GAJI_KARYAWAN, Type: OPEX</li>
                </ul>
            </div>

            {/* Payroll Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : payrolls.length === 0 ? (
                    <div className="p-8 text-center">
                        <HiOutlineBanknotes className="mx-auto w-12 h-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No payroll records</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Get started by processing your first payroll.
                        </p>
                        <div className="mt-6">
                            <button
                                onClick={() => setShowProcessForm(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                            >
                                <HiOutlinePlus className="w-5 h-5" />
                                Process Payroll
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Period
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Employees
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Gross
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Deduction
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Net
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {payrolls.map((payroll) => (
                                    <tr key={payroll.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {getMonthName(payroll.month)} {payroll.year}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {new Date(payroll.periodStart).toLocaleDateString('id-ID')} -{' '}
                                                {new Date(payroll.periodEnd).toLocaleDateString('id-ID')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {payroll.totalEmployees}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {formatCurrency(payroll.totalGross)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400">
                                            {formatCurrency(payroll.totalDeduction)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 dark:text-green-400">
                                            {formatCurrency(payroll.totalNet)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(payroll.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <Link
                                                href={`/admin/hris/payroll/${payroll.id}`}
                                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
                                                title="View Details"
                                            >
                                                <HiOutlineEye className="w-5 h-5 inline" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Process Form Modal */}
            {showProcessForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-md w-full">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                            Process New Payroll
                        </h3>
                        <form onSubmit={handleProcess} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Month
                                </label>
                                <select
                                    value={formData.month}
                                    onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                        <option key={m} value={m}>
                                            {getMonthName(m)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Year
                                </label>
                                <input
                                    type="number"
                                    value={formData.year}
                                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowProcessForm(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {processing ? 'Processing...' : 'Calculate'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

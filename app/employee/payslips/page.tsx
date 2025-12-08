'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { apiFetch, API_ENDPOINTS } from '@/lib/api-helper'
import { HiOutlineDocumentText, HiOutlineEye, HiOutlineArrowDownTray } from 'react-icons/hi2'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { PayslipCardSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'

interface Payslip {
    id: string
    month: number
    year: number
    basicSalary: string
    allowances: string
    overtimePay: string
    grossSalary: string
    tax: string
    insurance: string
    deductions: string
    netSalary: string
    daysWorked: number
    status: string
}

export default function PayslipsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { showToast } = useToast()
    const [payslips, setPayslips] = useState<Payslip[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null)

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/employee/login')
        } else if (status === 'authenticated') {
            loadPayslips()
        }
    }, [status, router])

    const loadPayslips = async () => {
        setLoading(true)
        try {
            const res = await apiFetch(API_ENDPOINTS.EMPLOYEE.PAYSLIPS)
            if (res.ok) {
                const data = await res.json()
                setPayslips(data.payslips || [])
            } else {
                showToast('error', 'Failed to load payslips')
            }
        } catch (error) {
            console.error('Error loading payslips:', error)
            showToast('error', 'Failed to load payslips')
        } finally {
            setLoading(false)
        }
    }

    const handleDownload = async (payslip: Payslip) => {
        try {
            showToast('info', 'Generating PDF...')
            const res = await fetch(`/api/hris/payslips/${payslip.id}/download`)
            if (res.ok) {
                const blob = await res.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `payslip-${payslip.year}-${String(payslip.month).padStart(2, '0')}.pdf`
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)
                showToast('success', 'Payslip downloaded successfully')
            } else {
                showToast('error', 'Failed to download payslip')
            }
        } catch (error) {
            console.error('Download error:', error)
            showToast('error', 'Failed to download payslip')
        }
    }

    const formatCurrency = (amount: string) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(Number(amount))
    }

    const getMonthName = (month: number) => {
        return new Date(2024, month - 1).toLocaleDateString('id-ID', { month: 'long' })
    }

    if (status === 'loading' || loading) {
        return (
            <div className="space-y-6">
                <div className="text-center">
                    <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded mx-auto mb-2 animate-pulse" />
                    <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mx-auto animate-pulse" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <PayslipCardSkeleton />
                    <PayslipCardSkeleton />
                    <PayslipCardSkeleton />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Payslips</h1>
                <p className="text-base sm:text-sm text-gray-600 dark:text-gray-400 mt-2">
                    View and download your salary slips
                </p>
            </div>

            {/* Payslips List */}
            {payslips.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {payslips.map((payslip) => (
                        <div key={payslip.id} className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 sm:p-6 hover:shadow-lg transition-all transform hover:scale-[1.02]">
                            <div className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-4">
                                <div className="p-3 sm:p-2.5 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0">
                                    <HiOutlineDocumentText className="w-7 h-7 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-base sm:text-sm text-gray-900 dark:text-white mb-1">
                                        {getMonthName(payslip.month)} {payslip.year}
                                    </h3>
                                    <span className="text-xs sm:text-[10px] px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                                        {payslip.status}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3 sm:space-y-2 mb-5 sm:mb-4">
                                <div className="flex justify-between text-base sm:text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Gross Salary:</span>
                                    <span className="font-semibold text-gray-900 dark:text-white text-right">
                                        {formatCurrency(payslip.grossSalary)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-base sm:text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Deductions:</span>
                                    <span className="font-semibold text-red-600 text-right">
                                        -{formatCurrency(String(Number(payslip.tax) + Number(payslip.insurance) + Number(payslip.deductions)))}
                                    </span>
                                </div>
                                <div className="pt-3 sm:pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <div className="flex justify-between">
                                        <span className="text-base sm:text-sm font-medium text-gray-700 dark:text-gray-300">Net Salary:</span>
                                        <span className="font-bold text-green-600 dark:text-green-400 text-right">
                                            {formatCurrency(payslip.netSalary)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 sm:gap-2">
                                <button
                                    onClick={() => setSelectedPayslip(payslip)}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-2 min-h-[48px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-base sm:text-sm font-medium touch-manipulation"
                                >
                                    <HiOutlineEye className="w-5 h-5 sm:w-4 sm:h-4" />
                                    View
                                </button>
                                <button
                                    onClick={() => handleDownload(payslip)}
                                    className="min-w-[48px] min-h-[48px] px-4 py-3 sm:py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation flex items-center justify-center"
                                    title="Download PDF"
                                    aria-label="Download PDF"
                                >
                                    <HiOutlineArrowDownTray className="w-5 h-5 sm:w-4 sm:h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState
                    icon={<HiOutlineDocumentText className="w-16 h-16" />}
                    title="No payslips available"
                    description="Your payslips will appear here once they are generated by HR."
                />
            )}

            {/* Payslip Detail Modal */}
            <Modal
                isOpen={!!selectedPayslip}
                onClose={() => setSelectedPayslip(null)}
                title={selectedPayslip ? `Payslip - ${getMonthName(selectedPayslip.month)} ${selectedPayslip.year}` : ''}
                size="2xl"
            >
                {selectedPayslip && (
                    <div className="space-y-6">
                        {/* Earnings */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Earnings</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Basic Salary:</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {formatCurrency(selectedPayslip.basicSalary)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Allowances:</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {formatCurrency(selectedPayslip.allowances)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Overtime Pay:</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {formatCurrency(selectedPayslip.overtimePay)}
                                    </span>
                                </div>
                                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <div className="flex justify-between">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Gross Salary:</span>
                                        <span className="font-bold text-gray-900 dark:text-white">
                                            {formatCurrency(selectedPayslip.grossSalary)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Deductions */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Deductions</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Tax (PPh 21):</span>
                                    <span className="font-semibold text-red-600">
                                        -{formatCurrency(selectedPayslip.tax)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Insurance:</span>
                                    <span className="font-semibold text-red-600">
                                        -{formatCurrency(selectedPayslip.insurance)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Other Deductions:</span>
                                    <span className="font-semibold text-red-600">
                                        -{formatCurrency(selectedPayslip.deductions)}
                                    </span>
                                </div>
                                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <div className="flex justify-between">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Total Deductions:</span>
                                        <span className="font-bold text-red-600">
                                            -{formatCurrency(String(Number(selectedPayslip.tax) + Number(selectedPayslip.insurance) + Number(selectedPayslip.deductions)))}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Net Salary */}
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-semibold text-gray-900 dark:text-white">Net Salary:</span>
                                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {formatCurrency(selectedPayslip.netSalary)}
                                </span>
                            </div>
                            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                Days Worked: {selectedPayslip.daysWorked} days
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-4">
                            <button
                                onClick={() => setSelectedPayslip(null)}
                                className="flex-1 px-4 py-3 sm:py-2 min-h-[48px] border border-gray-300 dark:border-gray-600 rounded-lg text-base sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation font-medium"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => handleDownload(selectedPayslip)}
                                className="flex-1 px-4 py-3 sm:py-2 min-h-[48px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 touch-manipulation font-medium text-base sm:text-sm"
                            >
                                <HiOutlineArrowDownTray className="w-5 h-5" />
                                Download PDF
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

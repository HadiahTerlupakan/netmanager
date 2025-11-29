'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiOutlineArrowLeft, HiOutlineCheckCircle, HiOutlineBanknotes } from 'react-icons/hi2'

interface PayrollDetail {
    id: string
    employee: {
        employeeId: string
        fullName: string
        department?: { name: string } | null
        position?: { title: string } | null
    }
    basicSalary: string
    allowances: string
    bonuses: string
    grossSalary: string
    deductions: string
    tax: string
    insurance: string
    totalDeduction: string
    netSalary: string
    overtimeHours: number
    overtimePay: string
    daysWorked: number
    daysAbsent: number
    lateCount: number
}

interface Payroll {
    id: string
    month: number
    year: number
    periodStart: string
    periodEnd: string
    totalGross: string
    totalNet: string
    totalEmployees: number
    status: string
    payrollDetails: PayrollDetail[]
}

export default function PayrollDetailPage() {
    const params = useParams()
    const router = useRouter()
    const [payroll, setPayroll] = useState<Payroll | null>(null)
    const [loading, setLoading] = useState(true)
    const [bankAccountId, setBankAccountId] = useState('')
    const [showPayModal, setShowPayModal] = useState(false)

    useEffect(() => {
        if (params.id) {
            fetchPayroll()
        }
    }, [params.id])

    const fetchPayroll = async () => {
        try {
            const res = await fetch(`/api/hris/payroll/${params.id}`)
            const data = await res.json()
            if (res.ok) {
                setPayroll(data)
            }
        } catch (error) {
            console.error('Error fetching payroll:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async () => {
        if (!confirm('Approve this payroll?')) return

        try {
            const res = await fetch(`/api/hris/payroll/${params.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'approve' }),
            })

            const data = await res.json()

            if (res.ok) {
                alert(`✅ ${data.message}`)
                fetchPayroll()
            } else {
                alert(`❌ Error: ${data.error}`)
            }
        } catch (error) {
            alert('Failed to approve payroll')
        }
    }

    const handleMarkPaid = async () => {
        if (!bankAccountId) {
            alert('Please select a bank account')
            return
        }

        try {
            const res = await fetch(`/api/hris/payroll/${params.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'mark_paid', bankAccountId }),
            })

            const data = await res.json()

            if (res.ok) {
                alert(`✅ ${data.message}`)
                setShowPayModal(false)
                fetchPayroll()
            } else {
                alert(`❌ Error: ${data.error}`)
            }
        } catch (error) {
            alert('Failed to mark payroll as paid')
        }
    }

    const formatCurrency = (amount: string) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(Number(amount))
    }

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            DRAFT: 'bg-gray-100 text-gray-800',
            CALCULATED: 'bg-blue-100 text-blue-800',
            APPROVED: 'bg-green-100 text-green-800',
            PAID: 'bg-indigo-100 text-indigo-800',
        }
        return <span className={`px-3 py-1 text-sm rounded-full ${colors[status]}`}>{status}</span>
    }

    if (loading) {
        return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
    }

    if (!payroll) {
        return <div>Payroll not found</div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/hris/payroll" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                        <HiOutlineArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Payroll - {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][payroll.month - 1]} {payroll.year}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            {payroll.totalEmployees} employees
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {getStatusBadge(payroll.status)}
                    {payroll.status === 'CALCULATED' && (
                        <button
                            onClick={handleApprove}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                        >
                            <HiOutlineCheckCircle className="w-5 h-5" />
                            Approve
                        </button>
                    )}
                    {payroll.status === 'APPROVED' && (
                        <button
                            onClick={() => setShowPayModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        >
                            <HiOutlineBanknotes className="w-5 h-5" />
                            Mark as Paid
                        </button>
                    )}
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Gross Salary</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        {formatCurrency(payroll.totalGross)}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Deduction</p>
                    <p className="text-2xl font-bold text-red-600 mt-2">
                        {formatCurrency(String(BigInt(payroll.totalGross) - BigInt(payroll.totalNet)))}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Net Salary</p>
                    <p className="text-2xl font-bold text-green-600 mt-2">
                        {formatCurrency(payroll.totalNet)}
                    </p>
                </div>
            </div>

            {/* Employee Details */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Basic</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allowances</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">OT Pay</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deduction</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {payroll.payrollDetails.map((detail) => (
                                <tr key={detail.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {detail.employee.fullName}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {detail.employee.department?.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        {formatCurrency(detail.basicSalary)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        {formatCurrency(detail.allowances)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        {formatCurrency(detail.overtimePay)}
                                        {detail.overtimeHours > 0 && (
                                            <div className="text-xs text-gray-500">({detail.overtimeHours}h)</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(detail.grossSalary)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                                        {formatCurrency(detail.totalDeduction)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                                        {formatCurrency(detail.netSalary)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        <div>{detail.daysWorked}d</div>
                                        {detail.daysAbsent > 0 && (
                                            <div className="text-xs text-red-500">-{detail.daysAbsent} absent</div>
                                        )}
                                        {detail.lateCount > 0 && (
                                            <div className="text-xs text-yellow-600">{detail.lateCount} late</div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mark as Paid Modal */}
            {showPayModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-md w-full">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                            Mark Payroll as Paid
                        </h3>
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                <strong>Finance Integration:</strong> This will automatically create a Pengeluaran entry in the Finance module with:
                            </p>
                            <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 ml-4 list-disc">
                                <li>Category: GAJI_KARYAWAN</li>
                                <li>Type: OPEX</li>
                                <li>Amount: {formatCurrency(payroll.totalNet)}</li>
                            </ul>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Bank Account (temporary - enter any ID)
                                </label>
                                <input
                                    type="text"
                                    value={bankAccountId}
                                    onChange={(e) => setBankAccountId(e.target.value)}
                                    placeholder="Enter bank account ID"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowPayModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleMarkPaid}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                    Confirm Payment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

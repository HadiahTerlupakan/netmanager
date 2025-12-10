'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { HiOutlinePlus } from 'react-icons/hi2'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { LeaveBalanceSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { apiFetch, API_ENDPOINTS } from '@/lib/api-helper'

interface LeaveBalance {
    leaveType: string
    totalDays: number
    usedDays: number
    remainingDays: number
}

interface LeaveRequest {
    id: string
    leaveType: string
    startDate: string
    endDate: string
    totalDays: number
    reason: string
    status: string
    createdAt: string
}

// Function to translate leave types from API
const translateLeaveType = (leaveType: string): string => {
    const translations: Record<string, string> = {
        'ANNUAL': 'Cuti Tahunan',
        'SICK': 'Cuti Sakit',
        'PERMISSION': 'Izin',
        'UNPAID': 'Cuti Tanpa Gaji',
        'Annual Leave': 'Cuti Tahunan',
        'Sick Leave': 'Cuti Sakit',
        'Permission': 'Izin',
        'Unpaid Leave': 'Cuti Tanpa Gaji'
    }
    return translations[leaveType] || leaveType
}

export default function EmployeeLeavePage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { showToast } = useToast()
    const [balances, setBalances] = useState<LeaveBalance[]>([])
    const [requests, setRequests] = useState<LeaveRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [showRequestForm, setShowRequestForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        leaveType: 'ANNUAL',
        startDate: '',
        endDate: '',
        reason: '',
    })

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/employee/login')
        } else if (status === 'authenticated') {
            loadData()
        }
    }, [status, router])

    const loadData = async () => {
        setLoading(true)
        try {
            // Fetch both leaves and balances from single endpoint
            const res = await apiFetch(API_ENDPOINTS.EMPLOYEE.LEAVES)
            if (res.ok) {
                const data = await res.json()
                if (data.success) {
                    setBalances(Object.values(data.balances).filter(b => typeof b === 'object') as LeaveBalance[])

                    // Transform balances object to array format expected by UI
                    // The UI expects an array of LeaveBalance objects
                    // We need to construct it from the balances object returned by API
                    const balancesArray = [
                        { ...data.balances.annual, leaveType: 'Cuti Tahunan' },
                        { ...data.balances.sick, leaveType: 'Cuti Sakit' }
                    ]
                    setBalances(balancesArray)

                    // Translate leave types in requests
                    const translatedRequests = (data.leaves || []).map((request: LeaveRequest) => ({
                        ...request,
                        leaveType: translateLeaveType(request.leaveType)
                    }))
                    setRequests(translatedRequests)
                }
            }
        } catch (error) {
            console.error('Error loading data:', error)
            showToast('error', 'Gagal memuat data cuti')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        setSubmitting(true)

        try {
            const res = await apiFetch(API_ENDPOINTS.EMPLOYEE.LEAVES, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            const data = await res.json()

            if (res.ok) {
                showToast('success', 'Pengajuan cuti berhasil dikirim!')
                setShowRequestForm(false)
                setFormData({ leaveType: 'ANNUAL', startDate: '', endDate: '', reason: '' })
                loadData()
            } else {
                showToast('error', data.error || 'Gagal mengajukan cuti')
            }
        } catch (error) {
            console.error('Error submitting leave:', error)
            showToast('error', 'Gagal mengajukan cuti')
        } finally {
            setSubmitting(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        }
        const statusText: Record<string, string> = {
            PENDING: 'Menunggu',
            APPROVED: 'Disetujui',
            REJECTED: 'Ditolak',
        }
        return <span className={`px-2 py-1 text-xs rounded-full font-medium ${colors[status]}`}>{statusText[status] || status}</span>
    }

    if (status === 'loading' || loading) {
        return (
            <div className="space-y-6">
                <div className="text-center">
                    <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mx-auto mb-2 animate-pulse" />
                    <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mx-auto animate-pulse" />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                    <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <LeaveBalanceSkeleton />
                        <LeaveBalanceSkeleton />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Manajemen Cuti</h1>
                <p className="text-base sm:text-sm text-gray-600 dark:text-gray-400 mt-2">Cek saldo cuti dan ajukan permintaan cuti</p>
            </div>

            {/* Leave Balances */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-5 sm:mb-4">Saldo Cuti</h2>
                {balances.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                        {balances.map((balance, index) => (
                            <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 sm:p-4 hover:border-indigo-500 transition-colors">
                                <div className="text-base sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 sm:mb-2">
                                    {balance.leaveType}
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <div className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
                                            {balance.remainingDays}
                                        </div>
                                        <div className="text-sm sm:text-xs text-gray-500 dark:text-gray-400 mt-1">hari tersisa</div>
                                    </div>
                                    <div className="text-right text-base sm:text-sm text-gray-600 dark:text-gray-400">
                                        Terpakai: {balance.usedDays} / {balance.totalDays}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-base sm:text-sm text-gray-500 dark:text-gray-400 text-center py-6 sm:py-4">
                        Tidak ada informasi saldo cuti tersedia
                    </p>
                )}
            </div>

            {/* Request Leave Button */}
            <button
                onClick={() => setShowRequestForm(true)}
                className="w-full flex items-center justify-center gap-3 min-h-[56px] py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl shadow-lg hover:from-indigo-600 hover:to-purple-700 transition-all transform hover:scale-[1.01] active:scale-[0.99] touch-manipulation text-base sm:text-sm font-semibold"
            >
                <HiOutlinePlus className="w-6 h-6 sm:w-5 sm:h-5" />
                Ajukan Cuti
            </button>

            {/* Request Form Modal */}
            <Modal
                isOpen={showRequestForm}
                onClose={() => !submitting && setShowRequestForm(false)}
                title="Ajukan Cuti Baru"
                size="md"
            >
                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-4">
                    <div>
                        <label className="block text-base sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-1">
                            Jenis Cuti *
                        </label>
                        <select
                            value={formData.leaveType}
                            onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                            className="w-full px-4 py-3 sm:py-2 min-h-[48px] border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-base sm:text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent touch-manipulation"
                            required
                        >
                            <option value="ANNUAL">Cuti Tahunan</option>
                            <option value="SICK">Cuti Sakit</option>
                            <option value="PERMISSION">Izin</option>
                            <option value="UNPAID">Cuti Tanpa Gaji</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-base sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-1">
                            Tanggal Mulai *
                        </label>
                        <input
                            type="date"
                            required
                            value={formData.startDate}
                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-3 sm:py-2 min-h-[48px] border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-base sm:text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent touch-manipulation"
                        />
                    </div>
                    <div>
                        <label className="block text-base sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-1">
                            Tanggal Selesai *
                        </label>
                        <input
                            type="date"
                            required
                            value={formData.endDate}
                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                            min={formData.startDate || new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-3 sm:py-2 min-h-[48px] border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-base sm:text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent touch-manipulation"
                        />
                    </div>
                    <div>
                        <label className="block text-base sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-1">
                            Alasan *
                        </label>
                        <textarea
                            required
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            rows={4}
                            placeholder="Mohon berikan alasan untuk pengajuan cuti Anda"
                            className="w-full px-4 py-3 sm:py-2 min-h-[100px] border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-base sm:text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent touch-manipulation resize-none"
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setShowRequestForm(false)}
                            disabled={submitting}
                            className="flex-1 px-4 py-3 sm:py-2 min-h-[48px] border border-gray-300 dark:border-gray-600 rounded-lg text-base sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 touch-manipulation font-medium"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-3 sm:py-2 min-h-[48px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 touch-manipulation font-medium text-base sm:text-sm"
                        >
                            {submitting ? 'Mengirim...' : 'Ajukan Cuti'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Riwayat Cuti */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-5 sm:mb-4">Riwayat Cuti</h2>
                {requests.length > 0 ? (
                    <div className="space-y-4 sm:space-y-3">
                        {requests.map((request) => (
                            <div
                                key={request.id}
                                className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 sm:p-4 hover:border-indigo-500 transition-colors"
                            >
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-2 mb-3 sm:mb-2">
                                    <div className="flex-1">
                                        <div className="font-medium text-base sm:text-sm text-gray-900 dark:text-white mb-1">
                                            {request.leaveType}
                                        </div>
                                        <div className="text-base sm:text-sm text-gray-600 dark:text-gray-400">
                                            {new Date(request.startDate).toLocaleDateString('id-ID')} -{' '}
                                            {new Date(request.endDate).toLocaleDateString('id-ID')} ({request.totalDays} hari)
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {getStatusBadge(request.status)}
                                    </div>
                                </div>
                                <div className="text-base sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{request.reason}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        title="Belum ada pengajuan cuti"
                        description="Anda belum mengajukan cuti. Klik tombol di atas untuk membuat pengajuan pertama Anda."
                    />
                )}
            </div>
        </div>
    )
}

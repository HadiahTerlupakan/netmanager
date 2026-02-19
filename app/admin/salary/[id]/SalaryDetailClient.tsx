
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiOutlineArrowLeft,
    HiOutlinePrinter,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineBanknotes,
    HiOutlineBriefcase,
    HiOutlineUser,
    HiOutlineArrowPath,
    HiOutlineChatBubbleLeftRight,
    HiOutlinePlusCircle,
} from 'react-icons/hi2'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { usePermission } from '@/hooks/use-permission'
import { toast } from 'react-hot-toast'
import { Modal, ModalFooter } from '@/components/ui/Modal'

interface SalaryRevision {
    field: string | null
    reason: string
    oldValue: string | null
    newValue: string | null
    createdAt: string | Date
    createdBy?: {
        name: string | null
    } | null
}

interface SalaryDetailItem {
    id: string
    name: string
    type: 'EARNING' | 'DEDUCTION'
    amount: number
    quantity?: number | null
    rate?: number | null
    notes?: string | null
}

interface SalaryWithDetails {
    id: string
    year: number
    month: number
    status: string
    basicSalary: number
    totalEarnings: number
    totalDeductions: number
    netSalary: number
    paidAt?: string | Date | null
    createdAt: string | Date
    user: {
        name: string | null
        email: string | null
        employeeType: string
        departments?: {
            name: string
        } | null
    }
    details: SalaryDetailItem[]
    revisions?: SalaryRevision[]
    auditedBy?: { name: string | null } | null
    approvedBy?: { name: string | null } | null
}

interface SalaryDetailClientProps {
    salary: SalaryWithDetails
    currentUser: {
        id: string
        name?: string | null
        role: string
    }
}

export default function SalaryDetailClient({ salary, currentUser: _currentUser }: SalaryDetailClientProps) {
    const router = useRouter()
    const { hasPermission } = usePermission()
    const [loading, setLoading] = useState(false)
    const [auditNotes, setAuditNotes] = useState('')
    const [showRevisionInput, setShowRevisionInput] = useState(false)

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    // Status colors
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'DRAFT': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
            case 'CALCULATED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
            case 'AUDITED': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800'
            case 'APPROVED': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border border-green-200 dark:border-green-800'
            case 'PAID': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
            case 'REVISED': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 border border-red-200 dark:border-red-800'
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
        }
    }

    // Actions
    const handleAction = async (action: 'audit' | 'approve' | 'paid' | 'revise' | 'recalculate', notes?: string) => {
        setLoading(true)
        const toastId = toast.loading('Memproses...')

        try {
            let endpoint = `/api/admin/salary/${salary.id}/`
            const method = 'POST'
            let body = {}

            if (action === 'audit') {
                endpoint += 'audit'
                body = { action: 'audit', notes }
            } else if (action === 'approve') {
                endpoint += 'approve'
                body = { action: 'approve' }
            } else if (action === 'paid') {
                endpoint += 'paid'
                body = {} // /paid route uses req.json() but doesn't strictly need fields
            } else if (action === 'recalculate') {
                endpoint += 'recalculate'
            } else if (action === 'revise') {
                endpoint = `/api/admin/salary/${salary.id}/revise`
                body = { reason: notes }
            }

            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.message || 'Terjadi kesalahan')
            }

            toast.success('Berhasil!', { id: toastId })
            router.refresh()
            setShowRevisionInput(false)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
            toast.error(message, { id: toastId })
        } finally {
            setLoading(false)
        }
    }

    // Manual Adjustment State
    const [showAdjustModal, setShowAdjustModal] = useState(false)
    const [adjustData, setAdjustData] = useState({
        name: '',
        type: 'EARNING' as 'EARNING' | 'DEDUCTION',
        amount: '',
        notes: ''
    })

    const handleAddAdjustment = async () => {
        if (!adjustData.name || !adjustData.amount || !adjustData.notes) {
            toast.error('Mohon lengkapi semua field')
            return
        }

        setLoading(true)
        const toastId = toast.loading('Menambahkan komponen...')

        try {
            const res = await fetch(`/api/admin/salary/${salary.id}/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...adjustData,
                    amount: Number(adjustData.amount)
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.message || 'Gagal menambah komponen')
            }

            toast.success('Komponen berhasil ditambahkan', { id: toastId })
            setShowAdjustModal(false)
            setAdjustData({ name: '', type: 'EARNING', amount: '', notes: '' })
            router.refresh()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
            toast.error(message, { id: toastId })
        } finally {
            setLoading(false)
        }
    }

    const earnings = salary.details.filter((d: SalaryDetailItem) => d.type === 'EARNING')
    const deductions = salary.details.filter((d: SalaryDetailItem) => d.type === 'DEDUCTION')

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
            {/* Header / Nav */}
            <div className="flex items-center gap-4">
                <Link href="/admin/salary" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <HiOutlineArrowLeft className="w-5 h-5 text-gray-500" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Detail Penggajian</h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        {new Date(salary.year, salary.month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Badge className={`${getStatusColor(salary.status)} px-3 py-1`}>
                        {salary.status}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Profile & Breakdown */}
                <div className="lg:col-span-2 space-y-6">
                    {/* User Profile */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${salary.user.employeeType === 'KARYAWAN' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
                                        }`}>
                                        {salary.user.name?.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{salary.user.name}</h3>
                                        <p className="text-sm text-gray-500">{salary.user.email}</p>
                                        <div className="flex gap-2 mt-2">
                                            <Badge className="flex items-center gap-1 bg-gray-100 text-gray-800 border border-gray-200">
                                                <HiOutlineBriefcase className="w-3 h-3" />
                                                {salary.user.departments?.name || 'No Dept'}
                                            </Badge>
                                            <Badge className="flex items-center gap-1 bg-gray-100 text-gray-800 border border-gray-200">
                                                <HiOutlineUser className="w-3 h-3" />
                                                {salary.user.employeeType}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-500 uppercase tracking-wider">Take Home Pay</div>
                                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                        {formatCurrency(salary.netSalary)}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Breakdown */}
                    <Card className="overflow-hidden">
                        <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <HiOutlineBanknotes className="w-5 h-5" />
                                Rincian Gaji
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {/* PENDAPATAN */}
                            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-sm font-bold text-green-600 uppercase tracking-wider">Pendapatan</h4>
                                    {salary.status === 'REVISED' && (
                                        <Button onClick={() => {
                                                setAdjustData({ ...adjustData, type: 'EARNING' })
                                                setShowAdjustModal(true)
                                            }}
                                            className="text-xs flex items-center gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 px-2 py-1 rounded transition-colors border border-transparent hover:border-green-200"
                                            title="Tambah Pendapatan Manual"
                                        >
                                            <HiOutlinePlusCircle className="w-4 h-4" />
                                            Tambah
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600 dark:text-gray-300">Gaji Pokok</span>
                                        <span className="font-medium">{formatCurrency(salary.basicSalary)}</span>
                                    </div>
                                    {earnings.filter((item: SalaryDetailItem) => item.name !== 'Gaji Pokok').map((item: SalaryDetailItem) => (
                                        <div key={item.id} className="flex justify-between items-center text-sm">
                                            <span className="text-gray-600 dark:text-gray-300">
                                                {item.name}
                                                {item.quantity && item.rate && (
                                                    <span className="text-xs text-gray-400 block">
                                                        {item.quantity} x {formatCurrency(item.rate)}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="font-medium">{formatCurrency(item.amount)}</span>
                                        </div>
                                    ))}
                                    <div className="pt-3 mt-2 border-t border-dashed border-gray-200 dark:border-gray-700 flex justify-between items-center font-bold">
                                        <span>Total Pendapatan</span>
                                        <span className="text-green-600">{formatCurrency(salary.totalEarnings)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* POTONGAN */}
                            <div className="p-6 bg-gray-50/50 dark:bg-gray-800/30">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-sm font-bold text-red-500 uppercase tracking-wider">Potongan</h4>
                                    {salary.status === 'REVISED' && (
                                        <Button onClick={() => {
                                                setAdjustData({ ...adjustData, type: 'DEDUCTION' })
                                                setShowAdjustModal(true)
                                            }}
                                            className="text-xs flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors border border-transparent hover:border-red-200"
                                            title="Tambah Potongan Manual"
                                        >
                                            <HiOutlinePlusCircle className="w-4 h-4" />
                                            Tambah
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {deductions.length > 0 ? deductions.map((item: SalaryDetailItem) => (
                                        <div key={item.id} className="flex justify-between items-center text-sm">
                                            <span className="text-gray-600 dark:text-gray-300">
                                                {item.name}
                                                {item.notes && <span className="text-xs text-gray-400 block">{item.notes}</span>}
                                            </span>
                                            <span className="font-medium text-red-500">-{formatCurrency(item.amount)}</span>
                                        </div>
                                    )) : (
                                        <p className="text-sm text-gray-400 italic">Tidak ada potongan</p>
                                    )}
                                    <div className="pt-3 mt-2 border-t border-dashed border-gray-200 dark:border-gray-700 flex justify-between items-center font-bold">
                                        <span>Total Potongan</span>
                                        <span className="text-red-500">-{formatCurrency(salary.totalDeductions)}</span>
                                    </div>


                                </div>
                            </div>

                            {/* NET */}
                            <div className="p-6 bg-green-50 dark:bg-green-900/10 flex justify-between items-center">
                                <span className="text-lg font-bold text-gray-900 dark:text-white">Gaji Bersih Diterima</span>
                                <span className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(salary.netSalary)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Revisions History */}
                    {salary.revisions && salary.revisions.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base text-gray-500 flex items-center gap-2">
                                    <HiOutlineChatBubbleLeftRight className="w-5 h-5" />
                                    Riwayat Revisi
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {salary.revisions.map((rev: SalaryRevision, idx: number) => {
                                    // Helper to format field name
                                    const getActionLabel = (field: string) => {
                                        if (field === 'status') return 'Perubahan Status'
                                        if (field === 'add:earning') return 'Penambahan Pendapatan'
                                        if (field === 'add:deduction') return 'Penambahan Potongan'
                                        if (field.startsWith('detail:')) return `Ubah Komponen: ${field.replace('detail:', '')}`
                                        return field
                                    }

                                    // Helper to format values that might contain descriptions
                                    // e.g. "Bonus: 500000" -> "Bonus: Rp 500.000"
                                    const getValueLabel = (val: string | null) => {
                                        if (!val) return '-'

                                        // Case 1: Pure number
                                        if (!isNaN(Number(val))) {
                                            return formatCurrency(Number(val))
                                        }

                                        // Case 2: "Label: Number" format (common in adjustments)
                                        const parts = val.split(':')
                                        if (parts.length === 2) {
                                            const label = (parts[0] ?? '').trim()
                                            const value = (parts[1] ?? '').trim()
                                            if (!isNaN(Number(value))) {
                                                return `${label}: ${formatCurrency(Number(value))}`
                                            }
                                        }

                                        return val
                                    }

                                    // Check if reason is a UUID (UUID regex)
                                    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

                                    // Determine display reason
                                    const displayReason = isUUID(rev.reason) ? (
                                        rev.field === 'status' ? 'Status updated via system/audit' : 'Manual adjustment'
                                    ) : rev.reason;

                                    return (
                                        <div key={idx} className="flex gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm border border-gray-100 dark:border-gray-700">
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="font-bold text-gray-900 dark:text-gray-100 block mb-1">
                                                            {getActionLabel(rev.field || 'General')}
                                                        </span>
                                                        <p className="text-gray-600 dark:text-gray-300 italic">
                                                            &quot;{displayReason}&quot;
                                                        </p>
                                                    </div>
                                                    <span className="text-xs text-gray-400">
                                                        {new Date(rev.createdAt).toLocaleString('id-ID')}
                                                    </span>
                                                </div>

                                                {rev.field && rev.field !== 'status' && (
                                                    <div className="mt-2 text-xs bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 inline-block">
                                                        {rev.oldValue ? (
                                                            <span>{getValueLabel(rev.oldValue)} <span className="text-gray-400 mx-1">→</span> </span>
                                                        ) : null}
                                                        <span className="font-medium text-gray-800 dark:text-gray-200">
                                                            {getValueLabel(rev.newValue)}
                                                        </span>
                                                    </div>
                                                )}

                                                {rev.field === 'status' && (
                                                    <div className="mt-2 text-xs">
                                                        <span className={`px-2 py-0.5 rounded ${getStatusColor(rev.oldValue || '')} border border-black/5`}>{rev.oldValue || '-'}</span>
                                                        <span className="text-gray-400 mx-2">→</span>
                                                        <span className={`px-2 py-0.5 rounded ${getStatusColor(rev.newValue || '')} border border-black/5`}>{rev.newValue}</span>
                                                    </div>
                                                )}

                                                <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                                                    <HiOutlineUser className="w-3 h-3" />
                                                    {rev.createdBy?.name || 'System'}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Column: Actions */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium uppercase text-gray-500 tracking-wider">Aksi & Approval</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Actions based on Status & Permission */}

                            {/* DRAFT / CALCULATED / REVISED -> Audit */}
                            {(salary.status === 'CALCULATED' || salary.status === 'REVISED') && hasPermission('salary:audit') && (
                                <>
                                    <div className="flex gap-2">
                                        <Button onClick={() => handleAction('audit')}
                                            disabled={loading}
                                            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                                        >
                                            <HiOutlineCheckCircle className="w-5 h-5" />
                                            Audit Selesai
                                        </Button>
                                        <Button onClick={() => handleAction('recalculate')}
                                            disabled={loading}
                                            className="flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold py-3 px-4 rounded-lg transition-colors border border-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800"
                                            title="Hitung ulang gaji (ambil data terbaru dari absensi & settings)"
                                        >
                                            <HiOutlineArrowPath className="w-5 h-5" />
                                        </Button>
                                    </div>

                                    {(salary.status === 'REVISED') && (
                                        <div className="p-3 bg-amber-50 border border-amber-100 rounded text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300 mb-2">
                                            Tips: Gunakan tombol <strong>+ Tambah Pendapatan/Potongan Manual</strong> di bagian rincian gaji untuk menambahkan komponen revisi.
                                        </div>
                                    )}

                                    {/* Minta Revisi - Only show if current status is NOT Revised */}
                                    {salary.status !== 'REVISED' && (
                                        !showRevisionInput ? (
                                            <Button onClick={() => setShowRevisionInput(true)}
                                                disabled={loading}
                                                className="w-full flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-medium py-3 px-4 rounded-lg transition-colors dark:bg-red-900/10 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                            >
                                                <HiOutlineXCircle className="w-5 h-5" />
                                                Minta Revisi
                                            </Button>
                                        ) : (
                                            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-lg space-y-3 border border-red-100 dark:border-red-800">
                                                <textarea
                                                    className="w-full p-2 border border-red-200 rounded text-sm focus:ring-2 focus:ring-red-500 outline-none dark:bg-red-950/30 dark:border-red-800 dark:text-red-200 dark:placeholder-red-400"
                                                    placeholder="Alasan revisi..."
                                                    rows={3}
                                                    value={auditNotes}
                                                    onChange={(e) => setAuditNotes(e.target.value)}
                                                />
                                                <div className="flex gap-2">
                                                    <Button onClick={() => handleAction('revise', auditNotes)}
                                                        disabled={!auditNotes || loading}
                                                        className="flex-1 bg-red-600 text-white text-sm py-2 rounded hover:bg-red-700 disabled:opacity-50"
                                                    >
                                                        Kirim Revisi
                                                    </Button>
                                                    <Button onClick={() => setShowRevisionInput(false)}
                                                        className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                                    >
                                                        Batal
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    )}
                                </>
                            )}

                            {/* AUDITED -> Approve */}
                            {salary.status === 'AUDITED' && hasPermission('salary:approve') && (
                                <div className="space-y-3">
                                    <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg text-sm text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200">
                                        <p className="font-semibold flex items-center gap-1">
                                            <HiOutlineCheckCircle className="w-4 h-4" />
                                            Diaudit oleh: {salary.auditedBy?.name || 'Unknown'}
                                        </p>
                                        <p className="text-xs mt-1 text-yellow-700 dark:text-yellow-300">
                                            Data telah diverifikasi dan siap untuk approval manajer.
                                        </p>
                                    </div>
                                    <Button onClick={() => handleAction('approve')}
                                        disabled={loading}
                                        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                                    >
                                        <HiOutlineCheckCircle className="w-5 h-5" />
                                        Approve Salary
                                    </Button>
                                    <Button onClick={() => setShowRevisionInput(true)}
                                        disabled={loading}
                                        className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium py-3 px-4 rounded-lg transition-colors dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                                    >
                                        Tolak / Revisi
                                    </Button>
                                    {showRevisionInput && (
                                        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-lg space-y-3 border border-red-100 dark:border-red-800">
                                            <textarea
                                                className="w-full p-2 border border-red-200 rounded text-sm focus:ring-2 focus:ring-red-500 outline-none dark:bg-red-950/30 dark:border-red-800 dark:text-red-200 dark:placeholder-red-400"
                                                placeholder="Alasan penolakan / revisi..."
                                                rows={3}
                                                value={auditNotes}
                                                onChange={(e) => setAuditNotes(e.target.value)}
                                            />
                                            <div className="flex gap-2">
                                                <Button onClick={() => handleAction('revise', auditNotes)}
                                                    disabled={!auditNotes || loading}
                                                    className="flex-1 bg-red-600 text-white text-sm py-2 rounded hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    Kirim Revisi
                                                </Button>
                                                <Button onClick={() => setShowRevisionInput(false)}
                                                    className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                                >
                                                    Batal
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* APPROVED -> Mark Paid */}
                            {salary.status === 'APPROVED' && hasPermission('salary:mark_paid') && (
                                <div className="space-y-3">
                                    <div className="bg-green-50 border border-green-100 p-3 rounded-lg text-sm text-green-800">
                                        <p className="font-semibold flex items-center gap-1">
                                            <HiOutlineCheckCircle className="w-4 h-4" />
                                            Disetujui oleh: {salary.approvedBy?.name || 'Unknown'}
                                        </p>
                                        <p className="text-xs mt-1 text-green-700">
                                            Gaji siap dibayarkan / ditransfer.
                                        </p>
                                    </div>
                                    <Button onClick={() => handleAction('paid')}
                                        disabled={loading}
                                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                                    >
                                        <HiOutlineBanknotes className="w-5 h-5" />
                                        Tandai Sudah Dibayar
                                    </Button>
                                </div>
                            )}

                            {/* PAID */}
                            {salary.status === 'PAID' && (
                                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg text-center">
                                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
                                        <HiOutlineCheckCircle className="w-8 h-8" />
                                    </div>
                                    <h3 className="font-bold text-emerald-900">Gaji Telah Dibayarkan</h3>
                                    <p className="text-sm text-emerald-700 mt-1">Pada {new Date(salary.paidAt).toLocaleDateString('id-ID')}</p>
                                </div>
                            )}

                            {/* Downloads - Available for all (if can view) */}
                            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
                                <Link
                                    href={`/admin/salary/slip/${salary.id}`}
                                    target="_blank"
                                    className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium py-2 px-4 rounded-lg transition-colors"
                                >
                                    <HiOutlinePrinter className="w-5 h-5" />
                                    Print Struk & PDF
                                </Link>
                                <div className="text-center text-xs text-gray-400">
                                    * Gunakan opsi "Save as PDF" saat print untuk download
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4 text-xs text-gray-500 space-y-2">
                            <div className="flex justify-between">
                                <span>Status</span>
                                <span className="font-mono">{salary.status}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>ID Transaksi</span>
                                <span className="font-mono">{salary.id.substring(0, 8)}...</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Dibuat</span>
                                <span className="font-mono">{new Date(salary.createdAt).toLocaleDateString('id-ID')}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
            {/* Manual Adjustment Modal */}
            <Modal
                isOpen={showAdjustModal}
                onClose={() => setShowAdjustModal(false)}
                title="Tambah Komponen Manual"
                size="md"
            >
                <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipe</label>
                                <div className="flex gap-2">
                                    <Button onClick={() => setAdjustData({ ...adjustData, type: 'EARNING' })}
                                        className={`flex-1 py-2 px-3 text-sm rounded border ${adjustData.type === 'EARNING' ? 'bg-green-100 border-green-500 text-green-700 font-bold dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}`}
                                    >
                                        Pendapatan
                                    </Button>
                                    <Button onClick={() => setAdjustData({ ...adjustData, type: 'DEDUCTION' })}
                                        className={`flex-1 py-2 px-3 text-sm rounded border ${adjustData.type === 'DEDUCTION' ? 'bg-red-100 border-red-500 text-red-700 font-bold dark:bg-red-900/30 dark:text-red-300' : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}`}
                                    >
                                        Potongan
                                    </Button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Komponen</label>
                                <input
                                    type="text"
                                    className="w-full p-2 border rounded focus:ring-2 ring-indigo-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                                    placeholder={adjustData.type === 'EARNING' ? "Contoh: Bonus Project, Susulan Lembur" : "Contoh: Potongan Kasbon, Denda"}
                                    value={adjustData.name}
                                    onChange={e => setAdjustData({ ...adjustData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jumlah (Rp)</label>
                                <input
                                    type="number"
                                    className="w-full p-2 border rounded focus:ring-2 ring-indigo-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                                    placeholder="0"
                                    value={adjustData.amount}
                                    onChange={e => setAdjustData({ ...adjustData, amount: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan / Alasan</label>
                                <textarea
                                    className="w-full p-2 border rounded focus:ring-2 ring-indigo-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                                    rows={2}
                                    placeholder="Alasan penambahan..."
                                    value={adjustData.notes}
                                    onChange={e => setAdjustData({ ...adjustData, notes: e.target.value })}
                                />
                            </div>
                </div>

                <ModalFooter>
                            <Button onClick={() => setShowAdjustModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                Batal
                            </Button>
                            <Button onClick={handleAddAdjustment}
                                disabled={loading || !adjustData.name || !adjustData.amount}
                                 className="flex-1"
                            >
                                Simpan
                            </Button>
                </ModalFooter>
            </Modal>
        </div>
    )
}

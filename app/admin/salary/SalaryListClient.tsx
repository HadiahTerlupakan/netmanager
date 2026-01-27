'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
    HiOutlineBanknotes,
    HiOutlineCalculator,
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineDocumentText,
    HiOutlineEye,
    HiOutlineFunnel,
    HiOutlineArrowPath,
} from 'react-icons/hi2'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'


interface Salary {
    id: string
    month: number
    year: number
    status: string
    basicSalary: number
    totalEarnings: number
    totalDeductions: number
    netSalary: number
    user: {
        id: string
        name: string | null
        email: string
        employeeType: string
        departments?: { name: string } | null
    }
    auditedBy?: { name: string | null } | null
    approvedBy?: { name: string | null } | null
    createdAt: string
}

interface PeriodStats {
    total: number
    draft: number
    calculated: number
    audited: number
    approved: number
    paid: number
    totalNetSalary: number
}

const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    CALCULATED: 'bg-blue-100 text-blue-700',
    AUDITED: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-green-100 text-green-700',
    PAID: 'bg-emerald-100 text-emerald-700',
    REVISED: 'bg-red-100 text-red-700',
}

const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export default function SalaryListClient() {
    const { data: session } = useSession()
    const [salaries, setSalaries] = useState<Salary[]>([])
    const [stats, setStats] = useState<PeriodStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [calculating, setCalculating] = useState(false)
    
    const currentDate = new Date()
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
    const [statusFilter, setStatusFilter] = useState<string>('')

    const fetchSalaries = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                month: selectedMonth.toString(),
                year: selectedYear.toString(),
            })
            if (statusFilter) params.append('status', statusFilter)

            const res = await fetch(`/api/admin/salary?${params}`)
            const data = await res.json()
            setSalaries(data.salaries || [])
            setStats(data.stats || null)
        } catch (error) {
            console.error('Error fetching salaries:', error)
        } finally {
            setLoading(false)
        }
    }, [selectedMonth, selectedYear, statusFilter])

    useEffect(() => {
        fetchSalaries()
    }, [fetchSalaries])

    const handleCalculateBulk = async () => {
        if (!confirm('Hitung gaji untuk semua karyawan aktif?')) return
        
        setCalculating(true)
        try {
            const res = await fetch('/api/admin/salary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'calculate-bulk',
                    month: selectedMonth,
                    year: selectedYear,
                }),
            })
            const data = await res.json()
            if (data.success) {
                alert(`Berhasil menghitung ${data.processed} gaji!`)
                fetchSalaries()
            } else {
                alert(data.error || 'Gagal menghitung gaji')
            }
        } catch (error) {
            console.error('Error:', error)
            alert('Terjadi kesalahan')
        } finally {
            setCalculating(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Manajemen Penggajian
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Kelola data gaji karyawan
                    </p>
                </div>
                <button
                    onClick={handleCalculateBulk}
                    disabled={calculating}
                    className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {calculating ? (
                        <HiOutlineArrowPath className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <HiOutlineCalculator className="w-4 h-4 mr-2" />
                    )}
                    {calculating ? 'Menghitung...' : 'Hitung Gaji Bulk'}
                </button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold">{stats.total}</div>
                            <div className="text-sm text-gray-500">Total</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-blue-600">{stats.calculated}</div>
                            <div className="text-sm text-gray-500">Calculated</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-yellow-600">{stats.audited}</div>
                            <div className="text-sm text-gray-500">Audited</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
                            <div className="text-sm text-gray-500">Approved</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-emerald-600">{stats.paid}</div>
                            <div className="text-sm text-gray-500">Paid</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="text-lg font-bold text-indigo-600">
                                {formatCurrency(stats.totalNetSalary)}
                            </div>
                            <div className="text-sm text-gray-500">Total Gaji</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Bulan</label>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="px-3 py-2 border rounded-lg"
                            >
                                {MONTHS.map((name, idx) => (
                                    <option key={idx} value={idx + 1}>{name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Tahun</label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="px-3 py-2 border rounded-lg"
                            >
                                {[2024, 2025, 2026].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Status</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2 border rounded-lg"
                            >
                                <option value="">Semua</option>
                                <option value="DRAFT">Draft</option>
                                <option value="CALCULATED">Calculated</option>
                                <option value="AUDITED">Audited</option>
                                <option value="APPROVED">Approved</option>
                                <option value="PAID">Paid</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Data Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Daftar Gaji - {MONTHS[selectedMonth - 1]} {selectedYear}</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <HiOutlineArrowPath className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                    ) : salaries.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <HiOutlineBanknotes className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p>Belum ada data gaji untuk periode ini</p>
                            <p className="text-sm mt-2">Klik "Hitung Gaji Bulk" untuk generate</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4">Karyawan</th>
                                        <th className="text-left py-3 px-4">Departemen</th>
                                        <th className="text-right py-3 px-4">Gaji Pokok</th>
                                        <th className="text-right py-3 px-4">Pendapatan</th>
                                        <th className="text-right py-3 px-4">Potongan</th>
                                        <th className="text-right py-3 px-4">Gaji Bersih</th>
                                        <th className="text-center py-3 px-4">Status</th>
                                        <th className="text-center py-3 px-4">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {salaries.map((salary) => (
                                        <tr key={salary.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <td className="py-3 px-4">
                                                <div className="font-medium">{salary.user.name || 'N/A'}</div>
                                                <div className="text-sm text-gray-500">{salary.user.email}</div>
                                            </td>
                                            <td className="py-3 px-4">
                                                {salary.user.departments?.name || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {formatCurrency(salary.basicSalary)}
                                            </td>
                                            <td className="py-3 px-4 text-right text-green-600">
                                                +{formatCurrency(salary.totalEarnings)}
                                            </td>
                                            <td className="py-3 px-4 text-right text-red-600">
                                                -{formatCurrency(salary.totalDeductions)}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold">
                                                {formatCurrency(salary.netSalary)}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <Badge className={STATUS_COLORS[salary.status]}>
                                                    {salary.status}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <Link
                                                        href={`/admin/salary/${salary.id}`}
                                                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-indigo-600 transition-colors"
                                                        title="Lihat Detail"
                                                    >
                                                        <HiOutlineEye className="w-4 h-4" />
                                                    </Link>
                                                    <a
                                                        href={`/admin/salary/slip/${salary.id}`}
                                                        target="_blank"
                                                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-indigo-600 transition-colors"
                                                        title="Lihat Slip"
                                                    >
                                                        <HiOutlineDocumentText className="w-4 h-4" />
                                                    </a>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
    HiOutlineArrowLeft, 
    HiOutlineUser, 
    HiOutlineBriefcase, 
    HiOutlineBanknotes, 
    HiOutlineClock, 
    HiOutlineCurrencyDollar,
    HiOutlineDocumentText,
    HiOutlinePencil
} from 'react-icons/hi2'
import Link from 'next/link'

interface Component {
    id: string
    name: string
    type: 'EARNING' | 'DEDUCTION'
    amount: number
    isTaxable: boolean
    rateType?: 'FIXED' | 'PERCENTAGE'
}

interface UserSalaryComponent {
    id: string
    amount: number
    notes?: string
    component: Component
}

interface SalaryUser {
    id: string
    name: string
    email: string
    image?: string
    employeeType: 'KARYAWAN' | 'MITRA'
    basicSalary: number
    
    overtimeRateNormal: number
    overtimeCalcTypeNormal: string
    overtimeRateHoliday: number
    overtimeCalcTypeHoliday: string
    overtimeRateNational: number
    overtimeCalcTypeNational: string
    
    woIncentiveRate: number
    lateDeductionRate: number
    absentDeductionRate: number
    
    departments?: { name: string }
    userSalaryComponents: UserSalaryComponent[]
}

export default function SalaryUserDetailClient() {
    const params = useParams()
    const router = useRouter()
    const [user, setUser] = useState<SalaryUser | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (params.id) {
            fetchUserDetail()
        }
    }, [params.id])

    const fetchUserDetail = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/admin/salary/users/${params.id}`)
            if (!res.ok) throw new Error('Gagal mengambil data')
            const data = await res.json()
            const responseData = data.data || data
            setUser(responseData.user)
        } catch (error) {
            console.error('Error:', error)
            alert('Gagal memuat detail karyawan')
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number | null | undefined) => {
        if (amount === undefined || amount === null) return '-'
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    // Colors for Avatar
    const getAvatarColor = (name: string) => {
        const colors = [
            'bg-blue-100 text-blue-600 border-blue-200',
            'bg-purple-100 text-purple-600 border-purple-200',
            'bg-emerald-100 text-emerald-600 border-emerald-200',
            'bg-amber-100 text-amber-600 border-amber-200',
            'bg-rose-100 text-rose-600 border-rose-200',
            'bg-indigo-100 text-indigo-600 border-indigo-200'
        ]
        const index = (name.length) % colors.length
        return colors[index]
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-500 animate-pulse">Memuat detail karyawan...</p>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="p-8 text-center text-gray-500">
                <p>Data karyawan tidak ditemukan</p>
                <button onClick={() => router.back()} className="text-indigo-600 mt-4 hover:underline">
                    Kembali
                </button>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => router.back()}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition-colors"
                >
                    <HiOutlineArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Detail Penggajian</h1>
                    <p className="text-sm text-gray-500">Konfigurasi gaji dan riwayat slip</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Profile & Config (1 Col) */}
                <div className="space-y-6">
                    {/* Profile Card */}
                    <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800">
                        <div className="h-24 bg-linear-to-r from-indigo-500 to-purple-600"></div>
                        <div className="px-6 pb-6 -mt-10 relative">
                            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold border-4 border-white dark:border-gray-900 shadow-sm mb-4 bg-white ${getAvatarColor(user.name).replace('bg-', 'text-').replace('text-', 'bg-').split(' ')[0]} ${getAvatarColor(user.name).split(' ')[1]}`}>
                                {user.name.substring(0, 2).toUpperCase()}
                            </div>
                            
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
                            <p className="text-sm text-gray-500 mb-4">{user.email}</p>

                            <div className="flex flex-wrap gap-2 text-sm">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                                    <HiOutlineBriefcase className="w-3 h-3 mr-1" />
                                    {user.departments?.name || 'No Dept'}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    user.employeeType === 'KARYAWAN' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-amber-100 text-amber-800'
                                }`}>
                                    <HiOutlineUser className="w-3 h-3 mr-1" />
                                    {user.employeeType}
                                </span>
                            </div>
                        </div>
                    </Card>

                    {/* Salary Info */}
                    <Card className="border-0 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800">
                        <CardHeader className=" pb-3 border-b border-gray-100 dark:border-gray-800">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <HiOutlineBanknotes className="w-5 h-5 text-gray-400" />
                                Informasi Dasar
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div>
                                <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Gaji Pokok</label>
                                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                                    {formatCurrency(user.basicSalary)}
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                                <label className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3 block">Rate Lembur</label>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Hari Biasa</span>
                                        <div className="flex items-center gap-2">
                                           <span className="font-mono">
                                                {user.overtimeCalcTypeNormal === 'PERCENTAGE' 
                                                    ? `${user.overtimeRateNormal}%` 
                                                    : formatCurrency(user.overtimeRateNormal)}
                                           </span> 
                                           <span className="text-xs text-gray-400 bg-gray-100 px-1.5 rounded">{user.overtimeCalcTypeNormal}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Hari Libur</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono">
                                                {user.overtimeCalcTypeHoliday === 'PERCENTAGE' 
                                                    ? `${user.overtimeRateHoliday}%` 
                                                    : formatCurrency(user.overtimeRateHoliday)}
                                            </span>
                                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 rounded">{user.overtimeCalcTypeHoliday}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Libur Nasional</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono">
                                                {user.overtimeCalcTypeNational === 'PERCENTAGE' 
                                                    ? `${user.overtimeRateNational}%` 
                                                    : formatCurrency(user.overtimeRateNational)}
                                            </span>
                                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 rounded">{user.overtimeCalcTypeNational}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500 font-medium">Insentif WO</label>
                                        <div className="text-green-600 font-medium mt-1">{formatCurrency(user.woIncentiveRate)}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 font-medium">Pot. Telat</label>
                                        <div className="text-red-500 font-medium mt-1">{formatCurrency(user.lateDeductionRate)}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 font-medium">Pot. Bolos</label>
                                        <div className="text-red-500 font-medium mt-1">{formatCurrency(user.absentDeductionRate)}</div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Components & History (2 Col) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Active Salary Components */}
                    <Card className="border-0 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800">
                         <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 dark:border-gray-800">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <HiOutlineDocumentText className="w-5 h-5 text-gray-400" />
                                Komponen Gaji Aktif
                            </CardTitle>
                            {/* Nanti di sini tombol Edit Components */}
                        </CardHeader>
                        <CardContent className="pt-0 p-0">
                            {user.userSalaryComponents.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    Belum ada komponen tambahan
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {user.userSalaryComponents.map((comp) => (
                                        <div key={comp.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                    comp.component.type === 'EARNING' 
                                                        ? 'bg-green-100 text-green-600' 
                                                        : 'bg-red-100 text-red-600'
                                                }`}>
                                                    {comp.component.type === 'EARNING' ? '+' : '-'}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                                        {comp.component.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {comp.component.type === 'EARNING' ? 'Penerimaan' : 'Potongan'}
                                                        {comp.component.isTaxable && ' • Kena Pajak'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`font-medium ${
                                                    comp.component.type === 'EARNING' 
                                                        ? 'text-green-600' 
                                                        : 'text-red-600'
                                                }`}>
                                                    {comp.component.rateType === 'PERCENTAGE' ? (
                                                        <div className="flex flex-col items-end">
                                                            <span>{comp.component.type === 'EARNING' ? '+' : '-'} {comp.amount}%</span>
                                                            <span className="text-xs opacity-75">
                                                                ({formatCurrency(Math.floor((comp.amount / 100) * (user.basicSalary || 0)))})
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span>
                                                            {comp.component.type === 'EARNING' ? '+' : '-'} {formatCurrency(comp.amount)}
                                                        </span>
                                                    )}
                                                </div>
                                                {comp.notes && (
                                                    <div className="text-xs text-gray-400 italic">{comp.notes}</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Payroll History (Placeholder) */}
                    <Card className="border-0 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800">
                         <CardHeader className="border-b border-gray-100 dark:border-gray-800">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <HiOutlineClock className="w-5 h-5 text-gray-400" />
                                Riwayat Slip Gaji
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 text-center text-gray-500">
                            <p>Belum ada riwayat penggajian untuk karyawan ini.</p>
                            <p className="text-sm mt-2 text-gray-400">Slip gaji akan muncul di sini setelah payroll dijalankan.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

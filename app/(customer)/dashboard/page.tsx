'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCustomerAuth } from '@/components/customer/CustomerAuthProvider'
import { CustomerNotificationBell } from '@/components/customer/CustomerNotificationBell'
import {
    MdRouter,
    MdBolt,
    MdCheckCircle,
    MdReceiptLong,
    MdArrowForward,
    MdDescription,
    MdSupportAgent,
    MdHistory,
    MdRocketLaunch
} from 'react-icons/md'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

interface Invoice {
    id: string
    status: string
    remainingAmount: number
    dueDate: string
}

interface DashboardData {
    profile: {
        nama: string
        idPelanggan: string
        status: string
        jatuhTempo: string
        paket: {
            nama: string
            bandwidth: { download: string; upload: string } | null
        } | null
    }
    connection: {
        isOnline: boolean
        ipAddress: string | null
    }
    pendingInvoice: {
        count: number
        totalAmount: number
        dueDate?: string
    } | null
}

export default function CustomerDashboardPage() {
    const { isLoading: authLoading, isAuthenticated } = useCustomerAuth()
    const [data, setData] = useState<DashboardData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login')
        }
    }, [authLoading, isAuthenticated, router])

    useEffect(() => {
        if (isAuthenticated) {
            fetchDashboardData()
        }
    }, [isAuthenticated])

    const fetchDashboardData = async () => {
        try {
            const [profileRes, usageRes, invoicesRes] = await Promise.all([
                fetch('/api/customer/profile'),
                fetch('/api/customer/usage'),
                fetch('/api/customer/invoices?limit=20'),
            ])

            // Check if profile request failed (e.g., 401 Unauthorized)
            if (!profileRes.ok) {
                console.error('Profile API failed:', profileRes.status)
                setIsLoading(false)
                return
            }

            const [profileJson, usageJson, invoicesJson] = await Promise.all([
                profileRes.json(),
                usageRes.ok ? usageRes.json() : { data: { connection: null } },
                invoicesRes.ok ? invoicesRes.json() : { invoices: [] },
            ])

            // Unpack data from standard API response wrapper if present
            // Profile uses apiSuccess -> { success: true, data: { profile: ... } }
            const profile = profileJson.data?.profile || profileJson.profile

            // Usage uses apiSuccess -> { success: true, data: { connection: ... } }
            const connection = usageJson.data?.connection || usageJson.connection

            // Invoices returns direct JSON -> { success: true, invoices: ... }
            const invoices = invoicesJson.invoices

            // Check if profile data exists
            if (!profile) {
                console.error('No profile data received', profileJson)
                setIsLoading(false)
                return
            }

            const pendingInvoices = invoices?.filter(
                (inv: Invoice) => inv.status === 'SENT' || inv.status === 'OVERDUE'
            ) || []

            const firstDue = pendingInvoices.length > 0 ? pendingInvoices[0].dueDate : null

            setData({
                profile: profile,
                connection: connection || null,
                pendingInvoice: pendingInvoices.length > 0 ? {
                    count: pendingInvoices.length,
                    totalAmount: pendingInvoices.reduce((sum: number, inv: Invoice) => sum + inv.remainingAmount, 0),
                    dueDate: firstDue
                } : null,
            })
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        )
    }

    if (!data) {
        return <div className="p-6 text-center text-gray-500">Gagal memuat data</div>
    }

    const isOnline = data.connection?.isOnline ?? false
    const packageName = data.profile?.paket?.nama || 'Belum berlangganan'
    const speed = data.profile?.paket?.bandwidth?.download || '0 Mbps'

    return (
        <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white font-sans antialiased transition-colors duration-200">
            <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922] shadow-xl">

                {/* Sticky Header */}
                <div className="sticky top-0 z-20 flex items-center bg-[#f6f7f8] dark:bg-[#101922] p-4 pb-2 justify-between border-b border-gray-100 dark:border-gray-800">
                    <div className="flex size-10 shrink-0 items-center">
                        <div
                            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 ring-2 ring-[#0d9488]/20"
                            style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuD8a4l1et4H6y9tvw2-dsRlvXW5O-Df8J5i_UAlUTBHO83Xgtyd89djr_nAI0ajI_l50LwTwhxpEzl94KOCqQYfuQS00H3wd0mQ8Eks22Tw34FVk9n0jPrHyls6mxx04w3t6U5fVGtZ0QBR4ldW8Usy-mc2a1tXXbxPEbYZuZY7ekiGSdfhByOwWgYWFOOis0brDCUh2FMvR8ApXOo8TTRtJ32RnSCrOU3P9vRfhHlrCeW75qySwkIiC_pxjYhNHgFObVmTCKxOzyA")' }}
                        ></div>
                    </div>
                    <div className="flex flex-col items-center">
                        <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] text-[#111418] dark:text-white">Dashboard</h2>
                    </div>
                    <div className="flex size-10 items-center justify-end">
                        <CustomerNotificationBell />
                    </div>
                </div>

                <div className="flex flex-col flex-1 pb-24">
                    {/* Greeting Section */}
                    <div className="px-4 pt-6 pb-2">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Selamat datang kembali,</p>
                        <h2 className="text-2xl font-bold leading-tight text-[#111418] dark:text-white">{data.profile.nama}</h2>
                    </div>

                    {/* Service Status Card */}
                    <div className="p-4">
                        <div className="bg-white dark:bg-[#1c2936] rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-start gap-4">
                                    <div className="flex items-center justify-center size-12 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-[#0d9488]">
                                        <MdRouter className="text-2xl" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold leading-tight dark:text-white">Internet Rumah</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{packageName}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="relative flex h-2.5 w-2.5">
                                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}></span>
                                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            </span>
                                            <span className={`text-xs font-semibold ${isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {isOnline ? 'Aktif & Stabil' : 'Gangguan / Offline'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <div className="flex flex-col p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Kecepatan</span>
                                    <div className="flex items-center gap-1.5">
                                        <MdBolt className="text-[#0d9488] text-lg" />
                                        <span className="font-bold text-sm dark:text-white">{speed}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status Perangkat</span>
                                    <div className="flex items-center gap-1.5">
                                        <MdCheckCircle className="text-[#0d9488] text-lg" />
                                        <span className="font-bold text-sm dark:text-white">Normal</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Billing Card */}
                    <div className="px-4 pb-4">
                        <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-[#0d9488] to-[#115e59] text-white shadow-lg p-5">
                            <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl"></div>
                            <div className="relative z-10 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-teal-100 text-sm font-medium mb-1">Tagihan Bulan Ini</p>
                                        <h3 className="text-3xl font-bold tracking-tight">
                                            Rp {(data.pendingInvoice?.totalAmount || 0).toLocaleString('id-ID')}
                                        </h3>
                                    </div>
                                    <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                                        <MdReceiptLong className="text-white text-xl" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`flex h-2 w-2 rounded-full ${data.pendingInvoice ? 'bg-orange-400' : 'bg-green-400'}`}></span>
                                    <p className="text-sm font-medium text-teal-50">
                                        {data.pendingInvoice?.dueDate
                                            ? `Jatuh tempo: ${new Date(data.pendingInvoice.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                            : 'Tagihan Lunas'
                                        }
                                    </p>
                                </div>
                                <div className="pt-2">
                                    <Link href="/tagihan">
                                        <Button variant="outline" className="w-full">
                                            <span>{data.pendingInvoice ? 'Bayar Sekarang' : 'Lihat Riwayat'}</span>
                                            <MdArrowForward className="text-sm" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Menu */}
                    <div className="px-4">
                        <h3 className="text-[#111418] dark:text-white text-lg font-bold mb-3 px-1">Menu Cepat</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <Link href="/paket">
                                <Button variant="ghost" className="w-full flex flex-col gap-3 h-auto items-start shadow-sm border border-gray-100 dark:border-gray-800 hover:border-[#0d9488]/50 group text-left">
                                    <div className="size-10 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-[#0d9488] group-hover:scale-110 transition-transform">
                                        <MdDescription className="text-2xl" />
                                    </div>
                                    <div>
                                        <h2 className="text-[#111418] dark:text-white text-sm font-bold leading-tight">Detail Layanan</h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Info Paket</p>
                                    </div>
                                </Button>
                            </Link>

                            <Link href="/dukungan">
                                <Button variant="ghost" className="w-full flex flex-col gap-3 h-auto items-start shadow-sm border border-gray-100 dark:border-gray-800 hover:border-[#0d9488]/50 group text-left">
                                    <div className="size-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                                        <MdSupportAgent className="text-2xl" />
                                    </div>
                                    <div>
                                        <h2 className="text-[#111418] dark:text-white text-sm font-bold leading-tight">Dukungan</h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Bantuan Live</p>
                                    </div>
                                </Button>
                            </Link>

                            <Link href="/riwayat">
                                <Button variant="ghost" className="w-full flex flex-col gap-3 h-auto items-start shadow-sm border border-gray-100 dark:border-gray-800 hover:border-[#0d9488]/50 group text-left">
                                    <div className="size-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                                        <MdHistory className="text-2xl" />
                                    </div>
                                    <div>
                                        <h2 className="text-[#111418] dark:text-white text-sm font-bold leading-tight">Riwayat</h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Transaksi</p>
                                    </div>
                                </Button>
                            </Link>

                            <Link href="/upgrade-paket">
                                <Button variant="ghost" className="w-full flex flex-col gap-3 h-auto items-start shadow-sm border border-gray-100 dark:border-gray-800 hover:border-[#0d9488]/50 group text-left">
                                    <div className="size-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
                                        <MdRocketLaunch className="text-2xl" />
                                    </div>
                                    <div>
                                        <h2 className="text-[#111418] dark:text-white text-sm font-bold leading-tight">Upgrade</h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tambah Kecepatan</p>
                                    </div>
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Promo Banner */}
                    <div className="p-4 mt-2">
                        <div className="relative w-full h-32 rounded-xl overflow-hidden shadow-sm group cursor-pointer">
                            <div
                                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                                style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA15sXp8rqLYcVDOrCKu93aWPbXbK7RDttRr972e0Gtiwn2EHLcm8OjpyKoPeDOvTPBiekfaLCq-P5K1cVT6O0iHqw5aQSy5rF8Cojl9TdUIpN1I8Hl0sp59oXpEr-MqGUyBK3Rl7P_p2LirA_P55s8kEARxQJJj6tUwuCXeMn26F8d5HUHXaFD4MQfwjNN9vkFRatq5AWYzPpnVyMg-HfMinvCR6myFP4epTz0IK477pT6CQR4aJZX26e65VrY4xtTqq7RIg6xs7I")' }}
                            ></div>
                            <div className="absolute inset-0 bg-linear-to-r from-black/80 to-transparent"></div>
                            <div className="relative z-10 p-5 h-full flex flex-col justify-center text-white">
                                <span className="bg-[#0d9488] text-xs font-bold px-2 py-0.5 rounded w-fit mb-2">PROMO</span>
                                <h3 className="font-bold text-lg leading-tight">Diskon 20% Add-on TV</h3>
                                <p className="text-xs text-gray-300 mt-1">Nikmati channel premium bulan ini.</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

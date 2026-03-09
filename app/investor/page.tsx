'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiOutlineBriefcase, HiOutlineUserGroup, HiOutlineCurrencyDollar } from 'react-icons/hi2'
import InvestorBottomNav from './components/InvestorBottomNav'
import { formatCurrency } from '@/lib/utils'

interface SubscriberStats {
    total?: number;
    active?: number;
    paying?: number;
    paymentRatio?: number;
}

interface DashboardProject {
    id: string;
    name: string;
    status: string;
    siteName: string;
}

interface DashboardData {
    totalActualRevenue?: number | string;
    activeProjectsCount?: number;
    totalInvestment?: number | string;
    subscribers?: SubscriberStats;
    projects?: DashboardProject[];
}

export default function InvestorDashboard() {
    const router = useRouter()
    const [data, setData] = useState<DashboardData | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await fetch('/api/investor/dashboard')
                if (!res.ok) {
                    if (res.status === 401) router.push('/investor/login')
                    return
                }
                const result = await res.json()
                setData(result as DashboardData)
            } catch {
                console.error("Dashboard fetch error")
            } finally {
                setIsLoading(false)
            }
        }
        fetchDashboard()
    }, [router])

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col min-h-screen bg-gray-50 dark:bg-black">
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                </div>
                <InvestorBottomNav />
            </div>
        )
    }

    if (!data) return null;

    const totalActual = data.totalActualRevenue ? Number(data.totalActualRevenue) : 0
    const activeCount = data.activeProjectsCount ? Number(data.activeProjectsCount) : 0
    const investment = data.totalInvestment ? Number(data.totalInvestment) : 0
    const subs = data.subscribers
    const paymentRatio = subs?.paymentRatio || 0

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-gray-50 dark:bg-black pb-24 overflow-y-auto custom-scrollbar">
            {/* Header section */}
            <div className="bg-gradient-to-b from-blue-700 to-blue-900 pb-16 pt-8 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                <div className="flex justify-between items-center mb-8 relative z-10">
                    <div>
                        <h1 className="text-white/80 text-sm font-medium">Selamat datang,</h1>
                        <h2 className="text-white text-xl font-bold tracking-tight">Investor Portfolio</h2>
                    </div>
                    <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                        <span className="text-white font-black text-lg">i</span>
                    </div>
                </div>

                <div className="relative z-10">
                    <p className="text-blue-100/70 text-sm uppercase tracking-wider font-bold mb-1">Total Investasi Aktif</p>
                    <h3 className="text-white text-3xl font-black">{formatCurrency(investment)}</h3>
                </div>
            </div>

            {/* Main Content Dashboard */}
            <div className="px-5 -mt-8 relative z-20 space-y-6">
                {/* Financial Summary Cards */}
                <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 shadow-xl shadow-gray-200/40 dark:shadow-none border border-gray-100 dark:border-neutral-800 flex flex-col border-b-4 border-b-green-500">
                    <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center mb-3">
                        <HiOutlineCurrencyDollar className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Profit Aktual (Realisasi)</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-1 break-words">{formatCurrency(totalActual)}</p>
                </div>

                {/* Subscribers Growth Card */}
                <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-xl shadow-gray-200/40 dark:shadow-none border border-gray-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                                <HiOutlineUserGroup className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pertumbuhan Pelanggan</h3>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-bold text-gray-400 uppercase">Proyek Aktif</span>
                            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{activeCount}</span>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Total Pelanggan Terdaftar</span>
                            </div>
                            <span className="text-base font-black text-gray-900 dark:text-white">{subs?.total || 0}</span>
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Subs. Aktif & Lunas</span>
                            </div>
                            <span className="text-base font-black text-gray-900 dark:text-white">{subs?.paying || 0}</span>
                        </div>

                        {/* Payment Ratio Progress Bar */}
                        <div className="pt-2">
                            <div className="flex justify-between text-xs font-bold mb-2">
                                <span className="text-gray-500">Payment Ratio</span>
                                <span className={paymentRatio > 80 ? 'text-green-500' : paymentRatio > 50 ? 'text-yellow-500' : 'text-red-500'}>
                                    {paymentRatio}%
                                </span>
                            </div>
                            <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${paymentRatio > 80 ? 'bg-green-500' : paymentRatio > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${paymentRatio}%`, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Projects Status Section */}
                {data.projects && data.projects.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Status Proyek Anda</h3>
                            <Link href="/investor/projects" className="text-xs font-bold text-blue-600 dark:text-blue-400">Lihat Semua</Link>
                        </div>

                        <div className="space-y-3">
                            {(data.projects || []).slice(0, 3).map((project) => (
                                <Link
                                    key={project.id}
                                    href={`/investor/projects/${project.id}`}
                                    className="bg-white dark:bg-neutral-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-neutral-800 flex items-center justify-between hover:border-blue-200 dark:hover:border-blue-900 transition-colors"
                                >
                                    <div className="flex-1 min-w-0 pr-4">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{project.name}</p>
                                        <p className="text-[10px] text-gray-500 truncate">{project.siteName}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter ${project.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' :
                                        project.status === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-700' :
                                            project.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                                                project.status === 'PENGADAAN' ? 'bg-blue-100 text-blue-800' :
                                                    project.status === 'PENGGELARAN_JARINGAN' ? 'bg-purple-100 text-purple-800' :
                                                        project.status === 'PENJUALAN' ? 'bg-indigo-100 text-indigo-800' :
                                                            project.status === 'TARGET_TERCAPAI' ? 'bg-emerald-500 text-white' :
                                                                project.status === 'SELESAI' ? 'bg-gray-800 text-white' :
                                                                    'bg-gray-100 text-gray-600'
                                        }`}>
                                        {project.status.replace(/_/g, ' ')}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Quick Action / Notice */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-neutral-800 dark:to-neutral-800 rounded-3xl p-5 border border-blue-100 dark:border-neutral-700 flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Lihat Detail RAB</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">Pantau setiap realisasi dan perkembangan investasi per proyek.</p>
                    </div>
                    <Link
                        href="/investor/projects"
                        className="p-3 bg-white dark:bg-neutral-900 shadow-md rounded-2xl text-blue-600 dark:text-blue-400 hover:scale-105 transition-transform"
                    >
                        <HiOutlineBriefcase className="w-5 h-5" />
                    </Link>
                </div>
            </div>

            <InvestorBottomNav />
        </div>
    )
}

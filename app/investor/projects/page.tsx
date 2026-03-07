'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiOutlineBriefcase, HiOutlineChevronRight, HiOutlineChartBar, HiOutlineCheckCircle, HiOutlineClock } from 'react-icons/hi2'
import InvestorBottomNav from '../components/InvestorBottomNav'
import { formatCurrency } from '@/lib/utils'

export default function InvestorProjects() {
    const router = useRouter()
    const [projects, setProjects] = useState<Record<string, unknown>[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch('/api/investor/projects')
                if (!res.ok) {
                    if (res.status === 401) router.push('/investor/login')
                    return
                }
                const data = await res.json()
                setProjects(data.projects || [])
            } catch (error) {
                console.error("Projects fetch error:", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchProjects()
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

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-gray-50 dark:bg-black pb-24 overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-6 py-5 sticky top-0 z-30 flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <HiOutlineBriefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-gray-900 dark:text-white">Daftar Proyek</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Proyek yang Anda danai</p>
                </div>
            </div>

            {/* List */}
            <div className="p-4 space-y-4">
                {projects.map((item) => {
                    const p = item as { id: string; name: string; siteName?: string; status: string; investmentAmount: string | number; totalActualRevenue: string | number; totalActualOpex?: string | number; profitSharePercent: number }
                    // Helper to get status colors based on new RabStatus
                    const getStatusUI = (status: string) => {
                        switch (status) {
                            case 'DRAFT': return { color: 'text-gray-500 bg-gray-50 dark:bg-gray-900/30', icon: HiOutlineClock }
                            case 'PENDING_APPROVAL': return { color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30', icon: HiOutlineClock }
                            case 'APPROVED': return { color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30', icon: HiOutlineCheckCircle }
                            case 'PENGADAAN': return { color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30', icon: HiOutlineChartBar }
                            case 'PENGGELARAN_JARINGAN': return { color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30', icon: HiOutlineChartBar }
                            case 'PENJUALAN': return { color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30', icon: HiOutlineChartBar }
                            case 'TARGET_TERCAPAI': return { color: 'text-white bg-emerald-500', icon: HiOutlineCheckCircle }
                            case 'SELESAI': return { color: 'text-white bg-gray-800 dark:bg-white dark:text-gray-900', icon: HiOutlineCheckCircle }
                            default: return { color: 'text-gray-500 bg-gray-50 dark:bg-gray-900/30', icon: HiOutlineClock }
                        }
                    }
                    const ui = getStatusUI(p.status)
                    const StatusIcon = ui.icon

                    return (
                        <Link
                            key={p.id}
                            href={`/investor/projects/${p.id}`}
                            className="block bg-white dark:bg-neutral-900 rounded-3xl p-5 shadow-xl shadow-gray-200/40 dark:shadow-none border border-gray-100 dark:border-neutral-800 hover:scale-[1.02] active:scale-[0.98] transition-transform relative overflow-hidden group"
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/20 transition-colors" />

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="pr-4">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight mb-1">{p.name}</h3>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" /> {p.siteName || 'Lokasi Global'}
                                        </p>
                                    </div>
                                    <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${ui.color}`}>
                                        <StatusIcon className="w-3 h-3" />
                                        <span>{p.status.replace(/_/g, ' ')}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-50 dark:border-neutral-800">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nilai Investasi</p>
                                        <p className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(Number(p.investmentAmount))}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Profit Aktual</p>
                                        <p className="text-sm font-black text-blue-600 dark:text-blue-400">
                                            {formatCurrency(Math.max(0, (Number(p.totalActualRevenue) - Number(p.totalActualOpex || 0))) * (Number(p.profitSharePercent) / 100))}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <HiOutlineChevronRight className="w-5 h-5 text-gray-300" />
                            </div>
                        </Link>
                    )
                })}

                {projects.length === 0 && !isLoading && (
                    <div className="text-center py-20 px-6">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <HiOutlineBriefcase className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Belum Ada Proyek</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">Anda belum terlibat dalam pendanaan proyek apapun saat ini.</p>
                    </div>
                )}
            </div>

            <InvestorBottomNav />
        </div>
    )
}

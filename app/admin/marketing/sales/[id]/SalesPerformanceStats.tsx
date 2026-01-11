'use client'

import { 
    HiOutlineClipboardDocumentCheck, // Approved
    HiOutlineXCircle, // Rejected
    HiOutlineClock, // Pending
    HiOutlineChartBar, // Total
    HiOutlineTrophy, // Target
    HiOutlineCalendarDays
} from 'react-icons/hi2'

interface SalesPerformanceData {
    user: {
        id: string
        name: string | null
    }
    target: number
    currentMonth: {
        approved: number
        rejected: number
        pending: number
        total: number
        progress: number
    }
    totalAllTime: number
    recentActivity: {
        id: string
        pelangganName: string
        status: string
        createdAt: string
        address: string | null
    }[]
}

export default function SalesPerformanceStats({ data }: { data: SalesPerformanceData | null }) {
    if (!data) return null

    const { currentMonth, target, recentActivity } = data

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <HiOutlineChartBar className="w-6 h-6 text-indigo-500" />
                Performa Bulan Ini
            </h2>

            {/* Target Progress Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/10 rounded-bl-full -mr-8 -mt-8 pointer-events-none" />
                
                <div className="flex items-center justify-between mb-4 relative z-10">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <HiOutlineTrophy className="w-5 h-5 text-amber-500" />
                            Target Canvasing
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Pencapaian bulan ini</p>
                    </div>
                    <div className="text-right">
                        <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{currentMonth.approved}</span>
                        <span className="text-gray-400 text-sm"> / {target}</span>
                    </div>
                </div>

                <div className="w-full h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                            currentMonth.progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${Math.min(currentMonth.progress, 100)}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs font-medium">
                    <span className="text-indigo-600 dark:text-indigo-400">{currentMonth.progress}% Tercapai</span>
                    <span className="text-gray-500">{Math.max(0, target - currentMonth.approved)} lagi untuk mencapai target</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard 
                    label="Disetujui" 
                    value={currentMonth.approved} 
                    icon={HiOutlineClipboardDocumentCheck} 
                    color="emerald" 
                    subtext="Canvasing valid"
                />
                <StatCard 
                    label="Menunggu" 
                    value={currentMonth.pending} 
                    icon={HiOutlineClock} 
                    color="amber" 
                    subtext="Sedang diproses"
                />
                <StatCard 
                    label="Ditolak" 
                    value={currentMonth.rejected} 
                    icon={HiOutlineXCircle} 
                    color="rose" 
                    subtext="Tidak valid / Batal"
                />
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                 <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineCalendarDays className="w-5 h-5 text-gray-500" />
                        Aktivitas Terakhir
                    </h3>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {recentActivity.length === 0 ? (
                        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                            Belum ada aktivitas canvasing.
                        </div>
                    ) : (
                        recentActivity.map((activity) => (
                            <div key={activity.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {activity.pelangganName}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                            {activity.address || 'Alamat tidak tersedia'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <StatusBadge status={activity.status} />
                                        <p className="text-xs text-gray-400 mt-1">
                                            {new Date(activity.createdAt).toLocaleDateString('id-ID', {
                                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, value, icon: Icon, color, subtext }: any) {
    const colorClasses: Record<string, string> = {
        emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
        amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-400">{subtext}</p>
            </div>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'APPROVED') {
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Disetujui</span>
    }
    if (status === 'REJECTED') {
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">Ditolak</span>
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Menunggu</span>
}

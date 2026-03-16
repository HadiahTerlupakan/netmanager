import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authConfig, getUserPermissions } from '@/lib/auth'
import { getMikroTikRouterRepository } from '@/lib/repositories'
import {
  HiOutlineServer,
  HiOutlineWifi,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineTrophy,
  HiOutlineWrench,
  HiArrowTrendingUp,
  HiOutlineCube,
  HiOutlineMegaphone,
  HiOutlineClipboardDocumentList,
  HiOutlineClock
} from 'react-icons/hi2'
import { DashboardSocketUpdate } from '@/components/dashboard/DashboardSocketUpdate'
import DashboardSiteTable from '@/components/dashboard/DashboardSiteTable'
import { getDashboardService } from '@/modules/admin/services/DashboardService'


// Force dynamic rendering to avoid database queries during build
export const dynamic = 'force-dynamic'

export async function ClientComponent() {
  const session = await getServerSession(authConfig)

  // If no session, let the layout/middleware handle it, or redirect
  if (!session?.user) {
    // This usually shouldn't happen if middleware protects /admin
    return null
  }

  const user = session.user
  // Load permissions from database since session doesn't store them (to reduce cookie size)
  const permissions = await getUserPermissions(user.id as string)

  // Use isSuperAdmin helper if available or check boolean flag directly
  const extendedUser = user as { isSuperAdmin?: boolean; role?: string }
  const isSuperAdmin = extendedUser.isSuperAdmin || user.role === 'SUPER_ADMIN' || user.role === 'Super Admin'

  // Check if user has dashboard access
  const hasDashboardAccess = isSuperAdmin || permissions.includes('dashboard:read')

  if (!hasDashboardAccess) {
    console.log(`[AdminDashboard] User ${user.id} (Role: ${user.role}) has no dashboard access. Redirecting to forbidden.`)
    redirect('/admin/forbidden')
  }

  // Ensure these repos are only called if we are staying on the dashboard
  const routerRepository = getMikroTikRouterRepository()

  const routerStats = await routerRepository.getStatistics()

  const dashboardService = getDashboardService()
  const topEmployees = await dashboardService.getTopEmployees()
  const topProblematicSites = await dashboardService.getTopProblematicSites()
  const topDismantleSites = await dashboardService.getTopDismantleSites()
  const topInstallationSites = await dashboardService.getTopInstallationSites()
  const systemSummary = await dashboardService.getSystemSummary()

  return (
    <div className="space-y-8">
      <DashboardSocketUpdate />

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-700 p-8 shadow-xl dark:from-indigo-900 dark:to-blue-900">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">
                    Selamat Datang, {user.name || 'Admin'}! 👋
                </h2>
                <p className="mt-2 text-blue-100 max-w-xl text-lg">
                    Berikut adalah overview performa sistem dan aktivitas jaringan terkini.
                </p>
            </div>
            <div className="hidden md:block">
                <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-white text-sm font-medium">
                    {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>
        </div>
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-blue-400/20 rounded-full blur-2xl"></div>
      </div>

      {/* Module Overview Grid */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            Overview Modul
            <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-800/50 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">Real-time</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Kehadiran (Attendance) */}
            <div className="bg-surface dark:bg-surface p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden group hover:border-blue-300 transition-colors">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <HiOutlineClock className="w-20 h-20 text-blue-600" />
                </div>
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                        <HiOutlineClock className="w-5 h-5" />
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">Kehadiran Hari Ini</h4>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Hadir (Tepat Waktu)</span>
                        <span className="font-bold text-green-600">{systemSummary.attendance.present}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Terlambat</span>
                        <span className="font-bold text-orange-500">{systemSummary.attendance.late}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Absen/Cuti</span>
                        <span className="font-bold text-red-500">{systemSummary.attendance.absent}</span>
                    </div>
                </div>
            </div>

            {/* 2. Work Order */}
            <div className="bg-surface dark:bg-surface p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden group hover:border-purple-300 transition-colors">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <HiOutlineClipboardDocumentList className="w-20 h-20 text-purple-600" />
                </div>
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
                        <HiOutlineClipboardDocumentList className="w-5 h-5" />
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">Tiket & WO (30 Hari)</h4>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Pending</span>
                        <span className="font-bold text-orange-500">{systemSummary.workOrder.pending}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Proses</span>
                        <span className="font-bold text-blue-500">{systemSummary.workOrder.inProgress}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Selesai</span>
                        <span className="font-bold text-green-600">{systemSummary.workOrder.completed}</span>
                    </div>
                </div>
            </div>

            {/* 3. Marketing */}
            <div className="bg-surface dark:bg-surface p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden group hover:border-pink-300 transition-colors">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <HiOutlineMegaphone className="w-20 h-20 text-pink-600" />
                </div>
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 rounded-lg">
                        <HiOutlineMegaphone className="w-5 h-5" />
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">Marketing & Sales</h4>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Total Poin</span>
                        <span className="font-bold text-pink-600">{systemSummary.marketing.totalPoints}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Klaim Approved</span>
                        <span className="font-bold text-green-600">{systemSummary.marketing.approvedClaims}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Klaim Pending</span>
                        <span className="font-bold text-orange-500">{systemSummary.marketing.pendingClaims}</span>
                    </div>
                </div>
            </div>

            {/* 4. Inventory */}
            <div className="bg-surface dark:bg-surface p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden group hover:border-emerald-300 transition-colors">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <HiOutlineCube className="w-20 h-20 text-emerald-600" />
                </div>
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                        <HiOutlineCube className="w-5 h-5" />
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">Inventaris Barang</h4>
                </div>
                <div className="flex flex-col justify-center h-20">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Jenis Barang</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                        {systemSummary.inventory.totalItems}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Terdaftar di sistem</p>
                </div>
            </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Active Users (Internet) */}
        <div className="group relative overflow-hidden rounded-2xl bg-surface dark:bg-surface p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Sessions</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{routerStats.totalUserOnline}</h3>
              <div className="mt-2 flex items-center text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 w-fit px-2 py-0.5 rounded-full">
                <HiArrowTrendingUp className="w-3 h-3 mr-1" />
                Live Users
              </div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300">
              <HiOutlineWifi className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Total Routers */}
        <div className="group relative overflow-hidden rounded-2xl bg-surface dark:bg-surface p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Routers</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{routerStats.total}</h3>
               <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Perangkat terdaftar</p>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300">
              <HiOutlineServer className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Router Online */}
        <div className="group relative overflow-hidden rounded-2xl bg-surface dark:bg-surface p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Router Online</p>
              <h3 className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">{routerStats.online}</h3>
              <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-2 font-medium">Running Well</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform duration-300">
              <HiOutlineCheckCircle className="w-8 h-8" />
            </div>
          </div>
        </div>

         {/* Router Offline */}
         <div className="group relative overflow-hidden rounded-2xl bg-surface dark:bg-surface p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Router Offline</p>
              <h3 className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{routerStats.offline}</h3>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-2 font-medium">Need Attention</p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform duration-300">
              <HiOutlineXCircle className="w-8 h-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Leaderboard & Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left Column: Top Employees (Leaderboard) */}
        <div className="xl:col-span-1">
            <div className="bg-surface dark:bg-surface rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden h-full">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800/20">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-yellow-100 text-yellow-600 rounded-lg dark:bg-yellow-900/30 dark:text-yellow-400">
                            <HiOutlineTrophy className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100">Top 5 Karyawan</h3>
                    </div>
                </div>
                <div className="p-2">
                    {topEmployees.map((employee, index) => (
                        <div key={employee.userId} className="relative flex items-center justify-between p-3 mb-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors group">
                             {/* Rank Number */}
                             <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-lg ${
                                 index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-400' : 'bg-transparent'
                             }`}></div>

                             <div className="flex items-center gap-4 pl-2">
                                 <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${
                                    index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 ring-2 ring-yellow-200 dark:ring-yellow-800' :
                                    index === 1 ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 ring-2 ring-gray-200 dark:ring-gray-700' :
                                    index === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 ring-2 ring-orange-200 dark:ring-orange-800' :
                                    'bg-slate-50 text-slate-500 dark:bg-gray-800/50 dark:text-slate-400'
                                }`}>
                                    {index + 1}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1">{employee.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                        {employee.site || 'General'}
                                    </p>
                                </div>
                             </div>

                             <div className="text-right">
                                <span className="inline-block px-2.5 py-1 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 text-xs font-bold rounded-lg">
                                    {employee.metrics.totalScore} pts
                                </span>
                             </div>
                        </div>
                    ))}
                     {topEmployees.length === 0 && (
                        <div className="text-center py-8 text-sm text-gray-400">Belum ada data karyawan</div>
                    )}
                </div>
            </div>
        </div>

        {/* Right Column: Site Status Tables (Span 2) */}
        <div className="xl:col-span-2 space-y-6">

            {/* Row 1: Problematic Sites */}
            <div className="bg-surface dark:bg-surface rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                         <div className="p-1.5 bg-red-100 text-red-600 rounded-lg dark:bg-red-900/30 dark:text-red-400">
                             <HiOutlineWrench className="w-5 h-5" />
                         </div>
                         <div>
                            <h3 className="font-bold text-gray-900 dark:text-gray-100">Site Bermasalah (Troubled)</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Berdasarkan jumlah tiket gangguan</p>
                         </div>
                    </div>
                </div>
                <div className="p-1">
                     <DashboardSiteTable
                        data={topProblematicSites}
                        color="red"
                        emptyMessage="Aman! Tidak ada site bermasalah signifikan."
                      />
                </div>
            </div>

            {/* Row 2: Operations (Split Grid for Dismantle & Install) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* New Installation */}
                 <div className="bg-surface dark:bg-surface rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-green-50/50 dark:bg-green-900/10">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Pemasangan Baru</h3>
                    </div>
                    <DashboardSiteTable
                        data={topInstallationSites}
                        color="green"
                        emptyMessage="Belum ada instalasi baru"
                    />
                 </div>

                 {/* Dismantle */}
                 <div className="bg-surface dark:bg-surface rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-orange-50/50 dark:bg-orange-900/10">
                         <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Site Dismantle</h3>
                    </div>
                    <DashboardSiteTable
                        data={topDismantleSites}
                        color="orange"
                        emptyMessage="Belum ada pemutusan"
                    />
                 </div>
            </div>

        </div>

      </div>
    </div>
  )
}

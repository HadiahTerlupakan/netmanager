import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authConfig, getUserPermissions } from '@/lib/auth'
import { ADMIN_MENU_CONFIG } from '@/lib/menu-config'
import { getUserRepository, getMikroTikRouterRepository } from '@/lib/repositories'
import { HiOutlineUsers } from 'react-icons/hi2'
import { HiOutlineServer } from 'react-icons/hi2'
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
  const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.role === 'Super Admin'

  // Check if user has dashboard access
  const hasDashboardAccess = isSuperAdmin || permissions.includes('dashboard:read')

  if (!hasDashboardAccess) {
    // Find first allowed route
    const findFirstRoute = (items: typeof ADMIN_MENU_CONFIG): string | null => {
      for (const item of items) {
        // Recursively check children first if they exist (to find leaf nodes)
        // OR check item itself.
        // Strategy: 
        // 1. Check if item itself is permitted.
        // 2. If item has children, check children.
        // 3. Return first match.

        // Check permission
        // Permission checking logic might need adjustment if item structure changed
        // But assuming generic MenuConfig structure:
        // Logic adapted from Sidebar.tsx to ensure consistency
        const permissionResource = item.code
          ? (item.code.includes('.') ? item.code.split('.').pop()! : item.code)
          : ''

        const _hasPerm = isSuperAdmin || (permissionResource
          ? permissions.includes(`${permissionResource.toLowerCase()}:read`)
          : true)

        // If item has children, try to find a valid route in children
        if (item.children && item.children.length > 0) {
          const childRoute = findFirstRoute(item.children)
          if (childRoute) return childRoute
        }

        if (item.path && item.path !== '/admin') {
          return item.path
        }
      }
      return null
    }

    const firstRoute = findFirstRoute(ADMIN_MENU_CONFIG)
    if (firstRoute) {
      redirect(firstRoute)
    }

    // Fallback if no route found
    return (
      <div className="p-8 text-center text-gray-500">
        <h2 className="text-xl font-bold mb-2">Akses Terbatas</h2>
        <p>Anda tidak memiliki akses ke halaman dashboard atau menu lainnya.</p>
      </div>
    )
  }

  // Ensure these repos are only called if we are staying on the dashboard
  const userRepository = getUserRepository()
  const totalUsers = await userRepository.count()

  const routerRepository = getMikroTikRouterRepository()

  const routerStats = await routerRepository.getStatistics()

  const dashboardService = getDashboardService()
  const topEmployees = await dashboardService.getTopEmployees()
  const topProblematicSites = await dashboardService.getTopProblematicSites()
  const topDismantleSites = await dashboardService.getTopDismantleSites()
  const topInstallationSites = await dashboardService.getTopInstallationSites()

  return (
    <div className="space-y-6">
      <DashboardSocketUpdate />
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Selamat Datang</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Overview sistem dan statistik pengguna</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Semua pengguna terdaftar</p>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <HiOutlineUsers className="text-2xl text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total Router</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{routerStats.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Semua router terdaftar</p>
            </div>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <HiOutlineServer className="text-2xl text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status MikroTik Routers</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Router Online</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{routerStats.online}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Router aktif</p>
              </div>
              <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-2xl">✓</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Router Offline</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{routerStats.offline}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Router tidak aktif</p>
              </div>
              <div className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span className="text-2xl">✗</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total User Online</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{routerStats.totalUserOnline}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">User aktif</p>
              </div>
              <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <HiOutlineUsers className="text-2xl text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Top 5 Employees */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Top 5 Karyawan</h3>
            <p className="text-xs text-gray-500">Score gabungan</p>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {topEmployees.map((employee, index) => (
                <div key={employee.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300 shrink-0">
                      #{index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={employee.name}>{employee.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {employee.role || '-'} {employee.site ? `• ${employee.site}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-sky-600 dark:text-sky-400">{employee.metrics.totalScore}</p>
                    <p className="text-[10px] text-gray-400">points</p>
                  </div>
                </div>
              ))}
              {topEmployees.length === 0 && (
                <div className="text-center py-4 text-xs text-gray-500">Belum ada data</div>
              )}
            </div>
          </div>
        </div>

        {/* Top 5 Problematic Sites */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Site Bermasalah</h3>
            <p className="text-xs text-gray-500">Tiket Trouble</p>
          </div>
          <DashboardSiteTable 
            data={topProblematicSites} 
            color="red" 
            emptyMessage="Tidak ada data troubled site" 
          />
        </div>

        {/* Top 5 Dismantle Sites */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Site Dismantle</h3>
            <p className="text-xs text-gray-500">Pemutusan</p>
          </div>
          <DashboardSiteTable 
            data={topDismantleSites} 
            color="orange" 
            emptyMessage="Tidak ada data dismantle" 
          />
        </div>

        {/* Top 5 New Installation Sites */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pemasangan Baru</h3>
            <p className="text-xs text-gray-500">Instalasi Baru</p>
          </div>
          <DashboardSiteTable 
            data={topInstallationSites} 
            color="green" 
            emptyMessage="Tidak ada data pasang baru" 
          />
        </div>

      </div>
    </div>
  )
}

import { getUserRepository, getMikroTikRouterRepository } from '@/lib/repositories'
import { HiOutlineUsers } from 'react-icons/hi2'
import { HiOutlineServer } from 'react-icons/hi2'
import { DashboardSocketUpdate } from '@/components/dashboard/DashboardSocketUpdate'
import { getTopEmployees, getTopProblematicSites, getTopDismantleSites, getTopInstallationSites } from '@/app/admin/_services/dashboard'


// Force dynamic rendering to avoid database queries during build
export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  const userRepository = getUserRepository()
  const totalUsers = await userRepository.count()

  const routerRepository = getMikroTikRouterRepository()

  const routerStats = await routerRepository.getStatistics()
  const topEmployees = await getTopEmployees()
  const topProblematicSites = await getTopProblematicSites()
  const topDismantleSites = await getTopDismantleSites()
  const topInstallationSites = await getTopInstallationSites()

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
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-3 py-2">Site</th>
                  <th scope="col" className="px-3 py-2 text-right">Jml</th>
                </tr>
              </thead>
              <tbody>
                {topProblematicSites.map((site, index) => (
                  <tr key={site.siteId} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${index === 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>#{index + 1}</span>
                        <span className="truncate max-w-[120px]" title={site.siteName}>{site.siteName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-red-600 dark:text-red-400">{site.count}</td>
                  </tr>
                ))}
                {topProblematicSites.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-center text-xs">No Data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 5 Dismantle Sites */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Site Dismantle</h3>
            <p className="text-xs text-gray-500">Pemutusan</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-3 py-2">Site</th>
                  <th scope="col" className="px-3 py-2 text-right">Jml</th>
                </tr>
              </thead>
              <tbody>
                {topDismantleSites.map((site, index) => (
                  <tr key={site.siteId} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${index === 0 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>#{index + 1}</span>
                        <span className="truncate max-w-[120px]" title={site.siteName}>{site.siteName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-orange-600 dark:text-orange-400">{site.count}</td>
                  </tr>
                ))}
                {topDismantleSites.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-center text-xs">No Data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 5 New Installation Sites */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pemasangan Baru</h3>
            <p className="text-xs text-gray-500">Instalasi Baru</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-3 py-2">Site</th>
                  <th scope="col" className="px-3 py-2 text-right">Jml</th>
                </tr>
              </thead>
              <tbody>
                {topInstallationSites.map((site, index) => (
                  <tr key={site.siteId} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${index === 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>#{index + 1}</span>
                        <span className="truncate max-w-[120px]" title={site.siteName}>{site.siteName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-green-600 dark:text-green-400">{site.count}</td>
                  </tr>
                ))}
                {topInstallationSites.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-center text-xs">No Data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}

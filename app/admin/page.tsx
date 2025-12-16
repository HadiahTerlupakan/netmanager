import { getUserRepository, getMikroTikRouterRepository } from '@/lib/repositories'
import { HiOutlineUsers } from 'react-icons/hi2'
import { HiOutlineServer } from 'react-icons/hi2'
import { DashboardSocketUpdate } from '@/components/dashboard/DashboardSocketUpdate'


// Force dynamic rendering to avoid database queries during build
export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  const userRepository = getUserRepository()
  const totalUsers = await userRepository.count()

  const routerRepository = getMikroTikRouterRepository()
  const routerStats = await routerRepository.getStatistics()

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
    </div>
  )
}

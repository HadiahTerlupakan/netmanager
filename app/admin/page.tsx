import { getUserRepository } from '@/lib/repositories'
import { Role } from '@prisma/client'

export default async function AdminHome() {
  const userRepository = getUserRepository()
  const totalUsers = await userRepository.count()
  const totalAdmins = await userRepository.countByRole(Role.ADMIN)
  const totalRegularUsers = await userRepository.countByRole(Role.USER)

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Selamat Datang</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Overview sistem dan statistik pengguna</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Semua pengguna</p>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Administrators</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAdmins}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Admin aktif</p>
            </div>
            <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="text-2xl">🔐</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Regular Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalRegularUsers}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Pengguna biasa</p>
            </div>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <span className="text-2xl">👤</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



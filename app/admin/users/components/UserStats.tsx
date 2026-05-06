import {
  HiOutlineUsers,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
} from "react-icons/hi2";

interface UserStatsProps {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
}

export default function UserStats({
  totalUsers,
  activeUsers,
  inactiveUsers,
}: UserStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <HiOutlineUsers className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalUsers}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total Pengguna
            </p>
          </div>
        </div>
      </div>
      <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-500/10 rounded-lg">
            <HiOutlineCheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {activeUsers}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pengguna Aktif
            </p>
          </div>
        </div>
      </div>
      <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-500/10 rounded-lg">
            <HiOutlineXCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {inactiveUsers}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pengguna Nonaktif
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

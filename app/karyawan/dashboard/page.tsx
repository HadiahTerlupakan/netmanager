export default function KaryawanDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Portal Karyawan</h1>
        <p className="text-gray-500 dark:text-gray-400">Selamat Datang di Portal Karyawan NetManager</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Pekerjaan Anda Hari Ini</h2>
        <p className="text-gray-500 dark:text-gray-400">Gunakan menu di samping untuk melihat Work Order, Absensi, atau Manajemen Barang.</p>
      </div>
    </div>
  )
}

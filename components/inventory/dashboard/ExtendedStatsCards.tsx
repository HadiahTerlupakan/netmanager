'use client'

import { HiOutlineCube, HiOutlineArchiveBox, HiOutlineBuildingOffice2, 
         HiOutlineExclamationTriangle, HiOutlineArrowDownCircle, 
         HiOutlineArrowUpCircle, HiOutlineCurrencyDollar, HiOutlineWrenchScrewdriver } from 'react-icons/hi2'

interface StatsData {
  totalJenisBarang: number
  totalStokUnit: number
  totalGudang: number
  totalAsset: number
  lowStockItems: number
  barangMasukBulanIni: number
  barangKeluarBulanIni: number
}

interface Props {
  stats: StatsData | null
  loading: boolean
}

export function ExtendedStatsCards({ stats, loading }: Props) {
  const statsCards = [
    {
      title: 'Jenis Barang',
      value: stats?.totalJenisBarang || 0,
      icon: HiOutlineCube,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      title: 'Total Stok',
      value: stats?.totalStokUnit || 0,
      icon: HiOutlineArchiveBox,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20'
    },
    {
      title: 'Gudang Aktif',
      value: stats?.totalGudang || 0,
      icon: HiOutlineBuildingOffice2,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    },
    {
      title: 'Total Aset',
      value: stats?.totalAsset || 0,
      icon: HiOutlineWrenchScrewdriver,
      color: 'bg-cyan-500',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20'
    },
    {
      title: 'Masuk (Bulan Ini)',
      value: stats?.barangMasukBulanIni || 0,
      icon: HiOutlineArrowDownCircle,
      color: 'bg-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      prefix: '+'
    },
    {
      title: 'Keluar (Bulan Ini)',
      value: stats?.barangKeluarBulanIni || 0,
      icon: HiOutlineArrowUpCircle,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      prefix: '-'
    },
    {
      title: 'Stok Menipis',
      value: stats?.lowStockItems || 0,
      icon: HiOutlineExclamationTriangle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      highlight: (stats?.lowStockItems || 0) > 0
    }
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              <div className="space-y-2">
                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
      {statsCards.map((stat, index) => (
        <div 
          key={index} 
          className={`${stat.bgColor} rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 transition-transform hover:scale-[1.02]`}
        >
          <div className="flex items-center gap-3">
            <div className={`${stat.color} p-2 rounded-lg`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                {stat.title}
              </p>
              <p className={`text-lg font-bold ${stat.highlight ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {stat.prefix || ''}{stat.value.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { HiOutlineArrowTrendingUp, HiOutlineArrowTrendingDown } from 'react-icons/hi2'
import { Button } from '@/components/ui/Button'

interface FastMovingItem {
  id: string
  kode: string
  nama: string
  totalKeluar: number
}

interface SlowMovingItem {
  id: string
  kode: string
  nama: string
  lastMovement: string | null
  daysSinceLastMove: number | null
}

interface Props {
  fastMoving: FastMovingItem[]
  slowMoving: SlowMovingItem[]
  loading: boolean
}

export function MovementRanking({ fastMoving, slowMoving, loading }: Props) {
  const [activeTab, setActiveTab] = useState<'fast' | 'slow'>('fast')

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          🏆 Ranking Pemakaian
        </h3>
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <Button onClick={() => setActiveTab('fast')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'fast'
                ? 'bg-white dark:bg-gray-600 text-green-600 dark:text-green-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <HiOutlineArrowTrendingUp className="inline w-4 h-4 mr-1" />
            Fast Moving
          </Button>
          <Button onClick={() => setActiveTab('slow')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'slow'
                ? 'bg-white dark:bg-gray-600 text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <HiOutlineArrowTrendingDown className="inline w-4 h-4 mr-1" />
            Slow Moving
          </Button>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {activeTab === 'fast' ? (
          fastMoving.length > 0 ? (
            fastMoving.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                    index === 0 ? 'bg-yellow-400 text-yellow-900' :
                    index === 1 ? 'bg-gray-300 text-gray-700' :
                    index === 2 ? 'bg-orange-400 text-orange-900' :
                    'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                  }`}>
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {item.nama}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.kode}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {item.totalKeluar.toLocaleString('id-ID')} unit
                </span>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              Belum ada data pemakaian
            </p>
          )
        ) : (
          slowMoving.length > 0 ? (
            slowMoving.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {item.nama}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.kode}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-orange-600 dark:text-orange-400">
                  {item.daysSinceLastMove !== null 
                    ? `${item.daysSinceLastMove} hari lalu`
                    : 'Tidak ada aktivitas'
                  }
                </span>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              Semua barang aktif bergerak
            </p>
          )
        )}
      </div>
    </div>
  )
}

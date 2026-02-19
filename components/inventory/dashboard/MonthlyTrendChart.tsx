'use client'

import { useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import type { TooltipItem } from 'chart.js'
import { HiOutlineCalendar, HiOutlineAdjustmentsHorizontal } from 'react-icons/hi2'
import { Button } from '@/components/ui/Button'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface TrendData {
  month: string
  masuk: number
  keluar: number
}

interface Props {
  data: TrendData[]
  loading: boolean
  onDateRangeChange?: (startDate: string, endDate: string) => void
}

// Preset options for quick selection
const presetOptions = [
  { label: '6 Bulan', value: 6 },
  { label: '3 Bulan', value: 3 },
  { label: '12 Bulan', value: 12 },
  { label: 'Tahun Ini', value: 'ytd' },
  { label: 'Custom', value: 'custom' }
]

export function MonthlyTrendChart({ data, loading, onDateRangeChange }: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<number | string>(6)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const handlePresetChange = (preset: number | string) => {
    setSelectedPreset(preset)
    
    if (preset === 'custom') {
      setShowDatePicker(true)
      return
    }
    
    setShowDatePicker(false)
    
    const now = new Date()
    let startDate: Date
    
    if (preset === 'ytd') {
      // Year to date
      startDate = new Date(now.getFullYear(), 0, 1)
    } else {
      // Number of months
      startDate = new Date(now.getFullYear(), now.getMonth() - (preset as number) + 1, 1)
    }
    
    if (onDateRangeChange) {
      onDateRangeChange(startDate.toISOString(), now.toISOString())
    }
  }

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate && onDateRangeChange) {
      onDateRangeChange(customStartDate, customEndDate)
    }
    setShowDatePicker(false)
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  const chartData = {
    labels: data.map(d => d.month),
    datasets: [
      {
        label: 'Barang Masuk',
        data: data.map(d => d.masuk),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(34, 197, 94)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'Barang Keluar',
        data: data.map(d => d.keluar),
        borderColor: 'rgb(249, 115, 22)',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(249, 115, 22)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 14 },
        bodyFont: { size: 13 },
        callbacks: {
          label: function(context: TooltipItem<'line'>) {
            return `${context.dataset.label}: ${(context.parsed.y as number).toLocaleString('id-ID')} unit`
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          callback: function(value: string | number) {
            return value.toLocaleString('id-ID')
          }
        }
      }
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      {/* Header with Date Range Selector */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          📈 Trend Barang
        </h3>
        
        {/* Date Range Controls */}
        <div className="flex items-center gap-2">
          {/* Preset Buttons */}
          <div className="hidden sm:flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {presetOptions.map((option) => (
              <Button
                key={option.value}
                onClick={() => handlePresetChange(option.value)}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedPreset === option.value
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {option.label}
              </Button>
            ))}
          </div>
          
          {/* Mobile Dropdown */}
          <div className="sm:hidden relative">
            <Button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
            >
              <HiOutlineAdjustmentsHorizontal className="w-4 h-4" />
              <span>Filter</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Custom Date Picker Panel */}
      {showDatePicker && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleCustomDateApply}
                disabled={!customStartDate || !customEndDate}
                 className="w-full"
              >
                Terapkan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-64">
        {data.length > 0 ? (
          <Line data={chartData} options={options} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <HiOutlineCalendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Tidak ada data untuk periode ini</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

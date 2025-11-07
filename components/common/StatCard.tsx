import { ReactNode } from 'react'

type StatCardProps = {
  label: string
  value: string | number
  icon?: ReactNode
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'gray' | 'red'
  size?: 'sm' | 'md'
}

const colorClasses = {
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
  orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  gray: 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800',
  red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
}

const valueColorClasses = {
  blue: 'text-blue-900 dark:text-blue-100',
  green: 'text-green-900 dark:text-green-100',
  orange: 'text-orange-900 dark:text-orange-100',
  purple: 'text-purple-900 dark:text-purple-100',
  gray: 'text-gray-900 dark:text-gray-100',
  red: 'text-red-900 dark:text-red-100',
}

export function StatCard({ label, value, icon, color = 'gray', size = 'md' }: StatCardProps) {
  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className={`text-xs font-medium mb-1 ${size === 'sm' ? 'text-[10px]' : ''}`}>
            {label}
          </div>
          <div className={`font-semibold ${valueColorClasses[color]} ${size === 'sm' ? 'text-base' : 'text-xl'}`}>
            {value}
          </div>
        </div>
        {icon && (
          <div className="ml-2 opacity-60">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}


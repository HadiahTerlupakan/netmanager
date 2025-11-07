import { ReactNode } from 'react'

type InfoCardProps = {
  title?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
}

export function InfoCard({ title, icon, children, className = '' }: InfoCardProps) {
  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 ${className}`}>
      {(title || icon) && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
          {icon && <div className="text-gray-600 dark:text-gray-400">{icon}</div>}
          {title && (
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          )}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}

type InfoItemProps = {
  label: string
  value: ReactNode
  icon?: ReactNode
}

export function InfoItem({ label, value, icon }: InfoItemProps) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
        {icon && <span className="text-gray-400">{icon}</span>}
        {label}
      </div>
      <div className="text-sm text-gray-900 dark:text-white">
        {value || <span className="text-gray-400">-</span>}
      </div>
    </div>
  )
}


type StatusBadgeProps = {
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  size?: 'sm' | 'md' | 'lg'
}

const statusConfig: Record<'AKTIF' | 'NONAKTIF' | 'MAINTENANCE', { label: string; bgColor: string; textColor: string; borderColor: string }> = {
  AKTIF: {
    label: 'Aktif',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    textColor: 'text-green-700 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  NONAKTIF: {
    label: 'Nonaktif',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    textColor: 'text-gray-700 dark:text-gray-400',
    borderColor: 'border-gray-200 dark:border-gray-800',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
  },
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status]
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border font-medium ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  )
}


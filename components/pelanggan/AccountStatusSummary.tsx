import { HiExclamationTriangle, HiCheckCircle, HiClock } from 'react-icons/hi2'

interface StatusSummaryProps {
    internetOnline: boolean
    tagihanStatus: 'LUNAS' | 'BELUM_LUNAS' | 'TERLAMBAT'
    daysUntilDueDate: number
}

export function AccountStatusSummary({ internetOnline, tagihanStatus, daysUntilDueDate }: StatusSummaryProps) {
    // Determine overall account health
    const isHealthy = internetOnline && tagihanStatus === 'LUNAS'
    const hasWarning = tagihanStatus === 'BELUM_LUNAS' && daysUntilDueDate <= 7
    const isCritical = tagihanStatus === 'TERLAMBAT' || (tagihanStatus === 'BELUM_LUNAS' && daysUntilDueDate <= 3)

    const getStatusColor = () => {
        if (isCritical) return 'red'
        if (hasWarning) return 'yellow'
        return 'green'
    }

    const getStatusText = () => {
        if (isCritical) return 'PERLU PERHATIAN'
        if (hasWarning) return 'PERINGATAN'
        return 'SEMUA BAIK'
    }

    const statusColor = getStatusColor()

    const statusStyles = {
        green: {
            bg: 'bg-green-50 dark:bg-green-900/20',
            border: 'border-green-200 dark:border-green-800',
            text: 'text-green-700 dark:text-green-400',
            icon: 'text-green-600 dark:text-green-400',
        },
        yellow: {
            bg: 'bg-yellow-50 dark:bg-yellow-900/20',
            border: 'border-yellow-200 dark:border-yellow-800',
            text: 'text-yellow-700 dark:text-yellow-400',
            icon: 'text-yellow-600 dark:text-yellow-400',
        },
        red: {
            bg: 'bg-red-50 dark:bg-red-900/20',
            border: 'border-red-200 dark:border-red-800',
            text: 'text-red-700 dark:text-red-400',
            icon: 'text-red-600 dark:text-red-400',
        },
    }

    const styles = statusStyles[statusColor]
    const StatusIcon = statusColor === 'green' ? HiCheckCircle : statusColor === 'yellow' ? HiClock : HiExclamationTriangle

    return (
        <div className={`${styles.bg} border ${styles.border} rounded-xl p-4 mb-6`}>
            <div className="flex items-start gap-3">
                <StatusIcon className={`w-6 h-6 ${styles.icon} flex-shrink-0 mt-0.5`} />
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className={`font-semibold ${styles.text}`}>
                            Status Akun: {getStatusText()}
                        </h3>
                    </div>
                    <div className="space-y-1.5 text-sm">
                        <div className="flex items-center gap-2">
                            <span className={internetOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                {internetOnline ? '●' : '○'}
                            </span>
                            <span className="text-gray-700 dark:text-gray-300">
                                Internet: {internetOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={tagihanStatus === 'LUNAS' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
                                {tagihanStatus === 'LUNAS' ? '✓' : '!'}
                            </span>
                            <span className="text-gray-700 dark:text-gray-300">
                                Tagihan: {tagihanStatus === 'LUNAS' ? 'Lunas' : tagihanStatus === 'TERLAMBAT' ? 'Terlambat' : 'Belum Lunas'}
                                {tagihanStatus !== 'LUNAS' && daysUntilDueDate > 0 && (
                                    <span className="ml-1">({daysUntilDueDate} hari lagi)</span>
                                )}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

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
        <div className={`${styles.bg} border ${styles.border} rounded-2xl p-4 md:p-5`}>
            <div className="flex items-start gap-3 md:gap-4">
                <StatusIcon className={`w-5 h-5 md:w-6 md:h-6 ${styles.icon} flex-shrink-0 mt-1`} />
                <div className="flex-1 min-w-0">
                    <h3 className={`text-sm md:text-base font-bold ${styles.text} mb-3`}>
                        Status Akun: {getStatusText()}
                    </h3>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className={`text-base ${internetOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {internetOnline ? '●' : '○'}
                            </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                <span className="font-medium">Internet:</span>{' '}
                                <span className={`font-semibold ${internetOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {internetOnline ? 'Online' : 'Offline'}
                                </span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-base ${tagihanStatus === 'LUNAS' ? 'text-green-600 dark:text-green-400' : tagihanStatus === 'TERLAMBAT' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                                {tagihanStatus === 'LUNAS' ? '✓' : '!'}
                            </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                <span className="font-medium">Tagihan:</span>{' '}
                                <span className={`font-semibold ${tagihanStatus === 'LUNAS' ? 'text-green-600 dark:text-green-400' : tagihanStatus === 'TERLAMBAT' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                                    {tagihanStatus === 'LUNAS' ? 'Lunas' : tagihanStatus === 'TERLAMBAT' ? 'Terlambat' : 'Belum Lunas'}
                                </span>
                                {tagihanStatus !== 'LUNAS' && daysUntilDueDate > 0 && (
                                    <span className="ml-1 text-gray-500 dark:text-gray-400">({daysUntilDueDate} hari lagi)</span>
                                )}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

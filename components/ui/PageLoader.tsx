'use client'

interface PageLoaderProps {
    message?: string
    variant?: 'page' | 'section' | 'inline'
    className?: string
}

export default function PageLoader({
    message = 'Memuat data...',
    variant = 'page',
    className = ''
}: PageLoaderProps) {
    if (variant === 'inline') {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-500 dark:text-gray-400">{message}</span>
            </div>
        )
    }

    if (variant === 'section') {
        return (
            <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
                <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
            </div>
        )
    }

    // Default 'page' variant
    return (
        <div className={`flex flex-col items-center justify-center min-h-[60vh] ${className}`}>
            <div className="relative">
                <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 rounded-full" />
                <div className="absolute top-0 left-0 w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium animate-pulse">
                {message}
            </p>
        </div>
    )
}

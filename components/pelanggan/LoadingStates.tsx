/**
 * Loading state components for customer portal
 */

import React from 'react'

// Skeleton loader for text
export function SkeletonText({ className = '' }: { className?: string }) {
    return (
        <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
    )
}

// Skeleton loader for dashboard card
export function SkeletonCard() {
    return (
        <div className="bg-white rounded-2xl shadow-md p-4 animate-pulse">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full" />
                    <div className="space-y-2">
                        <div className="h-3 w-20 bg-gray-200 rounded" />
                        <div className="h-4 w-32 bg-gray-200 rounded" />
                    </div>
                </div>
                <div className="h-8 w-24 bg-gray-200 rounded" />
            </div>
            <div className="grid grid-cols-3 gap-2">
                <div className="h-20 bg-gray-200 rounded-lg" />
                <div className="h-20 bg-gray-200 rounded-lg" />
                <div className="h-20 bg-gray-200 rounded-lg" />
            </div>
        </div>
    )
}

// Skeleton loader for billing card
export function SkeletonBillingCard() {
    return (
        <div className="bg-white rounded-xl shadow-sm p-5 animate-pulse">
            <div className="flex items-start justify-between mb-4">
                <div className="space-y-2">
                    <div className="h-5 w-32 bg-gray-200 rounded" />
                    <div className="h-4 w-40 bg-gray-200 rounded" />
                </div>
                <div className="h-6 w-20 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="h-8 w-32 bg-gray-200 rounded" />
                <div className="h-10 w-28 bg-gray-200 rounded-lg" />
            </div>
        </div>
    )
}

// Skeleton loader for list items
export function SkeletonList({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-3/4" />
                            <div className="h-3 bg-gray-200 rounded w-1/2" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

// Full page loading spinner
export function FullPageLoader({ message = 'Memuat data...' }: { message?: string }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600">{message}</p>
            </div>
        </div>
    )
}

// Inline loading spinner
export function InlineLoader({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-6 h-6 border-3',
        lg: 'w-8 h-8 border-4',
    }

    return (
        <div className={`${sizeClasses[size]} border-sky-500 border-t-transparent rounded-full animate-spin ${className}`} />
    )
}

// Loading overlay for existing content
export function LoadingOverlay({ message }: { message?: string }) {
    return (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-xl">
            <div className="text-center">
                <InlineLoader size="lg" className="mx-auto mb-3" />
                {message && <p className="text-sm text-gray-600">{message}</p>}
            </div>
        </div>
    )
}

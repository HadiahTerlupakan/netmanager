'use client'

interface SkeletonProps {
    className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
    return (
        <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
    )
}

export function CardSkeleton() {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
        </div>
    )
}

export function StatCardSkeleton() {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="h-8 w-1/3 mb-2" />
            <Skeleton className="h-4 w-1/4" />
        </div>
    )
}

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
    return (
        <div className="flex gap-4 py-4 border-b border-gray-200 dark:border-gray-700">
            {Array.from({ length: columns }).map((_, i) => (
                <Skeleton key={i} className="h-4 flex-1" />
            ))}
        </div>
    )
}

export function AttendanceCardSkeleton() {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            <div className="flex items-center justify-center gap-2 mb-4">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-12 w-32 mx-auto mb-2" />
            <Skeleton className="h-4 w-48 mx-auto" />
        </div>
    )
}

export function LeaveBalanceSkeleton() {
    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <Skeleton className="h-4 w-20 mb-3" />
            <div className="flex justify-between items-end">
                <div>
                    <Skeleton className="h-8 w-12 mb-1" />
                    <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
            </div>
        </div>
    )
}

export function PayslipCardSkeleton() {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-4 w-16" />
                </div>
            </div>
            <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                </div>
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
        </div>
    )
}

'use client';

interface SessionStatusBadgeProps {
    isOnline: boolean;
}

export function SessionStatusBadge({ isOnline }: SessionStatusBadgeProps) {
    if (isOnline) {
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                <span className="mr-1">●</span> Online
            </span>
        );
    }

    return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
            <span className="mr-1">○</span> Offline
        </span>
    );
}

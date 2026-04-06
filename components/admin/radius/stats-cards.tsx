'use client';

import { HiOutlineUsers, HiOutlineWifi, HiOutlineServer, HiOutlineCircleStack } from 'react-icons/hi2';

interface StatsCardsProps {
    totalUsers: number;
    onlineUsers: number;
    offlineUsers: number;
    trafficToday: {
        downloadGB: number;
        uploadGB: number;
    };
    loading?: boolean;
}

function formatTrafficFromGB(valueGB: number): string {
    if (!Number.isFinite(valueGB) || valueGB <= 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = valueGB * 1024 * 1024 * 1024;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }

    const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

export function StatsCards({
    totalUsers,
    onlineUsers,
    offlineUsers,
    trafficToday,
    loading = false,
}: StatsCardsProps) {
    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-3" />
                        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Users */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{totalUsers}</p>
                    </div>
                    <HiOutlineUsers className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Registered in RADIUS</p>
            </div>

            {/* Online Users */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Online Now</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">{onlineUsers}</p>
                    </div>
                    <HiOutlineWifi className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Active sessions</p>
            </div>

            {/* Offline Users */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Offline</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{offlineUsers}</p>
                    </div>
                    <HiOutlineServer className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Not connected</p>
            </div>

            {/* Today's Traffic */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Traffic Today</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                            {formatTrafficFromGB(trafficToday.downloadGB)}
                        </p>
                    </div>
                    <HiOutlineCircleStack className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    ↓ {formatTrafficFromGB(trafficToday.downloadGB)} | ↑ {formatTrafficFromGB(trafficToday.uploadGB)}
                </p>
            </div>
        </div>
    );
}

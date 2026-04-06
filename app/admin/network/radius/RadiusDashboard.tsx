'use client';

import { HiOutlineRefresh } from 'react-icons/hi';

import { StatsCards } from '@/components/admin/radius/stats-cards';
import { SessionsTable } from '@/components/admin/radius/sessions-table';
import { SyncControls } from '@/components/admin/radius/sync-controls';
import { useRadiusDashboardData } from '@/app/admin/network/radius/hooks/useRadiusDashboardData';

export default function RadiusDashboard() {
    const {
        stats,
        sessions,
        loading,
        refreshing,
        isConnected,
        resettingUsername,
        actionError,
        actionSuccess,
        setActionError,
        setActionSuccess,
        resetConnection,
        refresh,
    } = useRadiusDashboardData();

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                        RADIUS Dashboard
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Monitor PPPoE sessions and user statistics
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        type="button"
                        onClick={() => {
                            void refresh(true);
                        }}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                        <HiOutlineRefresh className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <SyncControls />
                </div>
            </div>

            {stats ? (
                <StatsCards
                    totalUsers={stats.totalUsers}
                    onlineUsers={stats.onlineUsers}
                    offlineUsers={stats.offlineUsers}
                    trafficToday={{
                        downloadGB: stats.totalTrafficToday?.downloadGB ?? 0,
                        uploadGB: stats.totalTrafficToday?.uploadGB ?? 0,
                    }}
                    loading={loading}
                />
            ) : (
                <StatsCards
                    totalUsers={0}
                    onlineUsers={0}
                    offlineUsers={0}
                    trafficToday={{ downloadGB: 0, uploadGB: 0 }}
                    loading={true}
                />
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Active Sessions
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {sessions.length} users currently online
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-600 animate-pulse' : 'bg-red-500'}`} />
                            <span>{isConnected ? 'Live Updates' : 'Offline'}</span>
                        </div>
                    </div>
                </div>
                <div className="p-6 space-y-3">
                    {actionSuccess && (
                        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                            {actionSuccess}
                            <button
                                type="button"
                                onClick={() => setActionSuccess(null)}
                                className="ml-2 underline"
                            >
                                Tutup
                            </button>
                        </div>
                    )}
                    {actionError && (
                        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                            {actionError}
                            <button
                                type="button"
                                onClick={() => setActionError(null)}
                                className="ml-2 underline"
                            >
                                Tutup
                            </button>
                        </div>
                    )}
                    <SessionsTable
                        sessions={sessions}
                        loading={loading}
                        onResetConnection={resetConnection}
                        resettingUsername={resettingUsername}
                    />
                </div>
            </div>

            {stats && stats.lastSyncTime && (
                <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    Last sync: {new Date(stats.lastSyncTime).toLocaleString('id-ID')}
                    {stats.lastSyncStats && (stats.lastSyncStats.created + stats.lastSyncStats.updated + stats.lastSyncStats.deleted > 0) && (
                        <span className="ml-2">
                            (Created: {stats.lastSyncStats.created}, Updated: {stats.lastSyncStats.updated}, Deleted: {stats.lastSyncStats.deleted})
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

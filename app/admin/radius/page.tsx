'use client';

import { useEffect, useState } from 'react';
import { StatsCards } from '@/components/admin/radius/stats-cards';
import { SessionsTable } from '@/components/admin/radius/sessions-table';
import { SyncControls } from '@/components/admin/radius/sync-controls';
import { HiOutlineRefresh } from 'react-icons/hi';

interface DashboardStats {
    totalUsers: number;
    onlineUsers: number;
    offlineUsers: number;
    totalTrafficToday: {
        download: string;
        upload: string;
        downloadGB: number;
        uploadGB: number;
    };
    lastSyncTime: string;
    lastSyncStats: {
        created: number;
        updated: number;
        deleted: number;
    };
}

interface Session {
    radAcctId: string;
    username: string | null;
    nasIpAddress: string;
    framedIpAddress: string | null;
    acctStartTime: string | null;
    uptimeHours: number;
    downloadMB: number;
    uploadMB: number;
    isOnline: boolean;
}

export default function RadiusDashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchData = async (showRefreshing = false) => {
        if (showRefreshing) setRefreshing(true);
        try {
            // Fetch stats
            const statsRes = await fetch('/api/admin/radius/dashboard/stats');
            const statsData = await statsRes.json();
            setStats(statsData);

            // Fetch sessions
            const sessionsRes = await fetch('/api/admin/radius/dashboard/recent-sessions?status=active&limit=50');
            const sessionsData = await sessionsRes.json();
            setSessions(sessionsData.sessions);
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchData();
    }, []);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            fetchData();
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, [autoRefresh]);

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            {/* Header */}
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
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                        <HiOutlineRefresh className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <SyncControls />
                </div>
            </div>

            {/* Statistics Cards */}
            {stats ? (
                <StatsCards
                    totalUsers={stats.totalUsers}
                    onlineUsers={stats.onlineUsers}
                    offlineUsers={stats.offlineUsers}
                    trafficToday={{
                        downloadGB: stats.totalTrafficToday.downloadGB,
                        uploadGB: stats.totalTrafficToday.uploadGB,
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

            {/* Active Sessions Table */}
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
                            <div className={`h-2 w-2 rounded-full ${autoRefresh ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`} />
                            <span>Auto-refresh {autoRefresh ? 'on' : 'off'}</span>
                        </div>
                    </div>
                </div>
                <div className="p-6">
                    <SessionsTable sessions={sessions} loading={loading} />
                </div>
            </div>

            {/* Last Sync Info */}
            {stats && (
                <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    Last sync: {new Date(stats.lastSyncTime).toLocaleString('id-ID')}
                    {stats.lastSyncStats.created + stats.lastSyncStats.updated + stats.lastSyncStats.deleted > 0 && (
                        <span className="ml-2">
                            (Created: {stats.lastSyncStats.created}, Updated: {stats.lastSyncStats.updated}, Deleted: {stats.lastSyncStats.deleted})
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

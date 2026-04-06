'use client';

import { SessionStatusBadge } from './session-status-badge';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

function formatUsage(valueMB: number): string {
    if (!Number.isFinite(valueMB) || valueMB <= 0) return '0 MB';
    if (valueMB < 1) {
        const kb = valueMB * 1024;
        return `${kb.toFixed(0)} KB`;
    }
    if (valueMB < 10) {
        return `${valueMB.toFixed(2)} MB`;
    }
    return `${valueMB.toFixed(0)} MB`;
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

interface SessionsTableProps {
    sessions: Session[];
    loading?: boolean;
    onResetConnection?: (username: string) => Promise<void>;
    resettingUsername?: string | null;
}

export function SessionsTable({ sessions, loading = false, onResetConnection, resettingUsername }: SessionsTableProps) {
    if (loading) {
        return (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Username</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">IP Address</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Started</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Uptime</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usage (↓/↑)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <tr key={i}>
                                <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse" /></td>
                                <td className="px-6 py-4"><div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" /></td>
                                <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28 animate-pulse" /></td>
                                <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" /></td>
                                <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" /></td>
                                <td className="px-6 py-4 text-right"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 ml-auto animate-pulse" /></td>
                                <td className="px-6 py-4 text-right"><div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24 ml-auto animate-pulse" /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    if (sessions.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No active sessions found</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Username</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">IP Address</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Started</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Uptime</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usage (↓/↑)</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:border-gray-700">
                    {sessions.map((session) => (
                        <tr key={session.radAcctId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                {session.username || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <SessionStatusBadge isOnline={session.isOnline} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-gray-300">
                                {session.framedIpAddress || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                {session.acctStartTime
                                    ? formatDistanceToNow(new Date(session.acctStartTime), {
                                        addSuffix: true,
                                        locale: localeId,
                                    })
                                    : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                {session.uptimeHours.toFixed(2)} hrs
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-gray-700 dark:text-gray-300">
                                {formatUsage(session.downloadMB)} / {formatUsage(session.uploadMB)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                <button
                                    type="button"
                                    disabled={!session.username || resettingUsername === session.username}
                                    onClick={() => {
                                        if (!session.username || !onResetConnection) return;
                                        if (!window.confirm(`Reset koneksi untuk ${session.username}?`)) return;
                                        void onResetConnection(session.username);
                                    }}
                                    className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {resettingUsername === session.username ? 'Resetting...' : 'Reset Connection'}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

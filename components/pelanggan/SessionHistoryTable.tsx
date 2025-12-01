'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { getWithExpiry } from '@/lib/utils/storage-with-expiry';

interface Session {
    sessionId: string;
    startTime: string;
    stopTime: string | null;
    durationHours: number;
    downloadMB: number;
    uploadMB: number;
    totalMB: number;
    ipAddress: string;
    isActive: boolean;
}

interface HistoryData {
    sessions: Session[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export function SessionHistoryTable() {
    const [history, setHistory] = useState<HistoryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    const fetchHistory = async (currentPage: number) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('pelanggan_token');
            const pelangganData = getWithExpiry<any>('pelanggan_data');
            
            if (!token || !pelangganData) {
                setLoading(false);
                return;
            }

            const response = await fetch(`/api/pelanggan/radius/history?page=${currentPage}&limit=10`, {
                headers: {
                    'x-pelanggan-token': token,
                    'x-pelanggan-data': JSON.stringify(pelangganData),
                },
            });

            if (response.ok) {
                const data = await response.json();
                setHistory(data);
            }
        } catch (error) {
            console.error('Failed to fetch session history:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory(page);
    }, [page]);

    if (loading && !history) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 md:p-6">
                <div className="h-6 md:h-7 bg-gray-200 dark:bg-gray-700 rounded-lg w-40 mb-5 md:mb-6 animate-pulse" />
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-20 md:h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (!history || history.sessions.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 md:p-6">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-4 md:mb-5">Riwayat Koneksi</h3>
                <div className="py-12 md:py-16 text-center">
                    <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">Belum ada riwayat koneksi</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-5 lg:p-6">
            <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-900 dark:text-white mb-4 md:mb-5 lg:mb-6 leading-tight">Riwayat Koneksi</h3>

            <div className="space-y-3">
                {history.sessions.map((session) => (
                    <div key={session.sessionId} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 transition-all duration-200 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className={`text-xs md:text-sm font-semibold px-2 py-1 rounded-lg ${session.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                                    {session.isActive ? '● AKTIF' : '○ Selesai'}
                                </span>
                                <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400 font-mono">{session.ipAddress}</span>
                            </div>
                            <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300 font-semibold">{session.durationHours.toFixed(2)} jam</span>
                        </div>
                        <div className="flex items-center justify-between text-xs md:text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium">
                                {session.startTime
                                    ? formatDistanceToNow(new Date(session.startTime), {
                                        addSuffix: true,
                                        locale: localeId,
                                    })
                                    : '-'}
                            </span>
                            <span className="font-mono font-semibold">
                                ↓{session.downloadMB.toFixed(0)} MB / ↑{session.uploadMB.toFixed(0)} MB
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            {history.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 min-h-[44px] min-w-[44px] touch-manipulation flex items-center justify-center"
                    >
                        Sebelumnya
                    </button>
                    <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400 font-medium text-center flex-1">
                        Halaman {history.pagination.page} dari {history.pagination.totalPages}
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(history.pagination.totalPages, p + 1))}
                        disabled={page === history.pagination.totalPages}
                        className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 min-h-[44px] min-w-[44px] touch-manipulation flex items-center justify-center"
                    >
                        Selanjutnya
                    </button>
                </div>
            )}
        </div>
    );
}

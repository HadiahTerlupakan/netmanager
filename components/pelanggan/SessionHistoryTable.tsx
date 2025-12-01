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
            <div className="bg-white rounded-2xl shadow-md p-5">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse" />
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (!history || history.sessions.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-md p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Riwayat Koneksi</h3>
                <p className="text-gray-500 text-sm text-center py-8">Belum ada riwayat koneksi</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-md p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Riwayat Koneksi</h3>

            <div className="space-y-2">
                {history.sessions.map((session) => (
                    <div key={session.sessionId} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium ${session.isActive ? 'text-green-600' : 'text-gray-600'}`}>
                                    {session.isActive ? '● AKTIF' : '○ Selesai'}
                                </span>
                                <span className="text-xs text-gray-500 font-mono">{session.ipAddress}</span>
                            </div>
                            <span className="text-xs text-gray-600 font-medium">{session.durationHours.toFixed(2)} jam</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>
                                {session.startTime
                                    ? formatDistanceToNow(new Date(session.startTime), {
                                        addSuffix: true,
                                        locale: localeId,
                                    })
                                    : '-'}
                            </span>
                            <span className="font-mono">
                                ↓{session.downloadMB.toFixed(0)} MB / ↑{session.uploadMB.toFixed(0)} MB
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            {history.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Sebelumnya
                    </button>
                    <span className="text-sm text-gray-600">
                        Halaman {history.pagination.page} dari {history.pagination.totalPages}
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(history.pagination.totalPages, p + 1))}
                        disabled={page === history.pagination.totalPages}
                        className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Selanjutnya
                    </button>
                </div>
            )}
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { HiWifi, HiSignal } from 'react-icons/hi2';
import { getWithExpiry } from '@/lib/utils/storage-with-expiry';

interface ConnectionStatus {
    isOnline: boolean;
    ipAddress?: string;
    uptimeHours?: number;
    downloadMB?: number;
    uploadMB?: number;
}

export function ConnectionStatusCard() {
    const [status, setStatus] = useState<ConnectionStatus>({ isOnline: false });
    const [loading, setLoading] = useState(true);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem('pelanggan_token');
            const pelangganData = getWithExpiry<any>('pelanggan_data');
            
            if (!token || !pelangganData) {
                return;
            }

            const response = await fetch('/api/pelanggan/radius/status', {
                headers: {
                    'x-pelanggan-token': token,
                    'x-pelanggan-data': JSON.stringify(pelangganData),
                },
            });

            if (response.ok) {
                const data = await response.json();
                setStatus(data);
            }
        } catch (error) {
            console.error('Failed to fetch connection status:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();

        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-5 animate-pulse">
                <div className="h-5 md:h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-3" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
            </div>
        );
    }

    return (
        <div className={`rounded-2xl shadow-sm border ${status.isOnline ? 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-400/20' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} p-5 md:p-6`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    {status.isOnline ? (
                        <HiWifi className="w-7 h-7 md:w-8 md:h-8 text-white" />
                    ) : (
                        <HiSignal className="w-7 h-7 md:w-8 md:h-8 text-gray-400 dark:text-gray-500" />
                    )}
                    <h3 className={`text-lg md:text-xl font-bold ${status.isOnline ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                        Internet
                    </h3>
                </div>
                <span className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-semibold ${status.isOnline ? 'bg-white/20 text-white backdrop-blur-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                    {status.isOnline ? '● ONLINE' : '○ OFFLINE'}
                </span>
            </div>

            {status.isOnline ? (
                <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-white/95 text-xs md:text-sm lg:text-base leading-relaxed">
                        <span className="font-medium">IP Address:</span>
                        <span className="font-mono text-xs md:text-sm lg:text-base">{status.ipAddress || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center text-white/95 text-xs md:text-sm lg:text-base leading-relaxed">
                        <span className="font-medium">Uptime:</span>
                        <span className="font-semibold">{status.uptimeHours?.toFixed(2) || '0'} jam</span>
                    </div>
                    <div className="flex justify-between items-center text-white/95 text-xs md:text-sm lg:text-base leading-relaxed">
                        <span className="font-medium">Usage:</span>
                        <span className="font-semibold">↓{status.downloadMB?.toFixed(0) || '0'} MB / ↑{status.uploadMB?.toFixed(0) || '0'} MB</span>
                    </div>
                </div>
            ) : (
                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm lg:text-base leading-relaxed">Tidak ada koneksi aktif</p>
            )}
        </div>
    );
}

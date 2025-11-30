'use client';

import { useEffect, useState } from 'react';
import { HiWifi, HiSignal } from 'react-icons/hi2';

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
            const response = await fetch('/api/pelanggan/radius/status', {
                headers: {
                    'x-pelanggan-token': token || '',
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
            <div className="bg-white rounded-2xl shadow-md p-5 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-24" />
            </div>
        );
    }

    return (
        <div className={`rounded-2xl shadow-md p-5 ${status.isOnline ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gray-100'}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {status.isOnline ? (
                        <HiWifi className="w-6 h-6 text-white" />
                    ) : (
                        <HiSignal className="w-6 h-6 text-gray-400" />
                    )}
                    <h3 className={`text-lg font-bold ${status.isOnline ? 'text-white' : 'text-gray-700'}`}>
                        Internet
                    </h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.isOnline ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
                    {status.isOnline ? '● ONLINE' : '○ OFFLINE'}
                </span>
            </div>

            {status.isOnline ? (
                <div className="space-y-2">
                    <div className="flex justify-between text-white/90 text-sm">
                        <span>IP Address:</span>
                        <span className="font-mono">{status.ipAddress || '-'}</span>
                    </div>
                    <div className="flex justify-between text-white/90 text-sm">
                        <span>Uptime:</span>
                        <span>{status.uptimeHours?.toFixed(2) || '0'} hours</span>
                    </div>
                    <div className="flex justify-between text-white/90 text-sm">
                        <span>Usage:</span>
                        <span>↓{status.downloadMB?.toFixed(0) || '0'} MB / ↑{status.uploadMB?.toFixed(0) || '0'} MB</span>
                    </div>
                </div>
            ) : (
                <p className="text-gray-500 text-sm">Tidak ada koneksi aktif</p>
            )}
        </div>
    );
}

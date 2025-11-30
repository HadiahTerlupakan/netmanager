'use client';

import { useEffect, useState } from 'react';
import { HiArrowUpTray, HiArrowDownTray } from 'react-icons/hi2';

interface UsageData {
    today: {
        downloadGB: number;
        uploadGB: number;
        totalGB: number;
        sessionCount: number;
        totalHours: number;
    };
    thisMonth: {
        downloadGB: number;
        uploadGB: number;
        totalGB: number;
        sessionCount: number;
        totalHours: number;
    };
}

export function UsageStatsCard() {
    const [usage, setUsage] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUsage = async () => {
        try {
            const token = localStorage.getItem('pelanggan_token');
            const response = await fetch('/api/pelanggan/radius/usage', {
                headers: {
                    'x-pelanggan-token': token || '',
                },
            });

            if (response.ok) {
                const data = await response.json();
                setUsage(data);
            }
        } catch (error) {
            console.error('Failed to fetch usage stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsage();

        // Auto-refresh every 60 seconds
        const interval = setInterval(fetchUsage, 60000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="bg-white rounded-2xl shadow-md p-5 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4" />
                <div className="space-y-3">
                    <div className="h-20 bg-gray-200 rounded" />
                    <div className="h-20 bg-gray-200 rounded" />
                </div>
            </div>
        );
    }

    if (!usage) {
        return (
            <div className="bg-white rounded-2xl shadow-md p-5">
                <p className="text-gray-500 text-sm">Gagal memuat data pemakaian</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-md p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Pemakaian Data</h3>

            {/* Today's Usage */}
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Hari Ini</span>
                    <span className="text-xs text-gray-500">{usage.today.sessionCount} sesi</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                        <HiArrowDownTray className="w-5 h-5 text-green-600 mx-auto mb-1" />
                        <p className="text-lg font-bold text-gray-900">{usage.today.downloadGB.toFixed(2)} GB</p>
                        <p className="text-xs text-gray-500">Download</p>
                    </div>
                    <div className="text-center">
                        <HiArrowUpTray className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                        <p className="text-lg font-bold text-gray-900">{usage.today.uploadGB.toFixed(2)} GB</p>
                        <p className="text-xs text-gray-500">Upload</p>
                    </div>
                </div>
                <div className="mt-2 pt-2 border-t border-blue-100 text-center">
                    <p className="text-xs text-gray-600">Total: <span className="font-semibold">{usage.today.totalGB.toFixed(2)} GB</span></p>
                </div>
            </div>

            {/* This Month's Usage */}
            <div className="p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Bulan Ini</span>
                    <span className="text-xs text-gray-500">{usage.thisMonth.sessionCount} sesi</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                        <HiArrowDownTray className="w-5 h-5 text-green-600 mx-auto mb-1" />
                        <p className="text-lg font-bold text-gray-900">{usage.thisMonth.downloadGB.toFixed(2)} GB</p>
                        <p className="text-xs text-gray-500">Download</p>
                    </div>
                    <div className="text-center">
                        <HiArrowUpTray className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                        <p className="text-lg font-bold text-gray-900">{usage.thisMonth.uploadGB.toFixed(2)} GB</p>
                        <p className="text-xs text-gray-500">Upload</p>
                    </div>
                </div>
                <div className="mt-2 pt-2 border-t border-purple-100 text-center">
                    <p className="text-xs text-gray-600">
                        Total: <span className="font-semibold">{usage.thisMonth.totalGB.toFixed(2)} GB</span>
                        {' • '}
                        <span className="font-semibold">{usage.thisMonth.totalHours.toFixed(1)} jam</span>
                    </p>
                </div>
            </div>
        </div>
    );
}

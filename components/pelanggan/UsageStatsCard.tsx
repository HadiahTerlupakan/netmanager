'use client';

import { useEffect, useState } from 'react';
import { HiArrowUpTray, HiArrowDownTray } from 'react-icons/hi2';
import { getWithExpiry } from '@/lib/utils/storage-with-expiry';

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
            const pelangganData = getWithExpiry<any>('pelanggan_data');
            
            if (!token || !pelangganData) {
                return;
            }

            const response = await fetch('/api/pelanggan/radius/usage', {
                headers: {
                    'x-pelanggan-token': token,
                    'x-pelanggan-data': JSON.stringify(pelangganData),
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 md:p-6 animate-pulse">
                <div className="h-6 md:h-7 bg-gray-200 dark:bg-gray-700 rounded-lg w-40 mb-5 md:mb-6" />
                <div className="space-y-4">
                    <div className="h-24 md:h-28 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                    <div className="h-24 md:h-28 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                </div>
            </div>
        );
    }

    if (!usage) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 md:p-6">
                <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">Gagal memuat data pemakaian</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-5 lg:p-6">
            <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-900 dark:text-white mb-4 md:mb-5 lg:mb-6 leading-tight">Pemakaian Data</h3>

            {/* Today's Usage */}
            <div className="mb-4 p-4 md:p-5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm md:text-base font-semibold text-gray-900 dark:text-white">Hari Ini</span>
                    <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400 font-medium">{usage.today.sessionCount} sesi</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="text-center">
                        <HiArrowDownTray className="w-6 h-6 md:w-7 md:h-7 text-green-600 dark:text-green-400 mx-auto mb-2" />
                        <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white leading-tight">{usage.today.downloadGB.toFixed(2)} GB</p>
                        <p className="text-[10px] md:text-xs lg:text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">Download</p>
                    </div>
                    <div className="text-center">
                        <HiArrowUpTray className="w-6 h-6 md:w-7 md:h-7 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                        <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white leading-tight">{usage.today.uploadGB.toFixed(2)} GB</p>
                        <p className="text-[10px] md:text-xs lg:text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">Upload</p>
                    </div>
                </div>
                <div className="pt-3 border-t border-blue-200 dark:border-blue-700/50 text-center">
                    <p className="text-sm md:text-base text-gray-700 dark:text-gray-300">Total: <span className="font-bold text-gray-900 dark:text-white">{usage.today.totalGB.toFixed(2)} GB</span></p>
                </div>
            </div>

            {/* This Month's Usage */}
            <div className="p-4 md:p-5 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800/50">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm md:text-base font-semibold text-gray-900 dark:text-white">Bulan Ini</span>
                    <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400 font-medium">{usage.thisMonth.sessionCount} sesi</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="text-center">
                        <HiArrowDownTray className="w-6 h-6 md:w-7 md:h-7 text-green-600 dark:text-green-400 mx-auto mb-2" />
                        <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white leading-tight">{usage.thisMonth.downloadGB.toFixed(2)} GB</p>
                        <p className="text-[10px] md:text-xs lg:text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">Download</p>
                    </div>
                    <div className="text-center">
                        <HiArrowUpTray className="w-6 h-6 md:w-7 md:h-7 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                        <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white leading-tight">{usage.thisMonth.uploadGB.toFixed(2)} GB</p>
                        <p className="text-[10px] md:text-xs lg:text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">Upload</p>
                    </div>
                </div>
                <div className="pt-3 border-t border-purple-200 dark:border-purple-700/50 text-center">
                    <p className="text-sm md:text-base text-gray-700 dark:text-gray-300">
                        Total: <span className="font-bold text-gray-900 dark:text-white">{usage.thisMonth.totalGB.toFixed(2)} GB</span>
                        {' • '}
                        <span className="font-bold text-gray-900 dark:text-white">{usage.thisMonth.totalHours.toFixed(1)} jam</span>
                    </p>
                </div>
            </div>
        </div>
    );
}

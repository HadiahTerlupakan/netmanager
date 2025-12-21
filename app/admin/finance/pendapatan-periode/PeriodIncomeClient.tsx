"use client";

import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id } from "date-fns/locale";
import {
    HiOutlineCalendar,
    HiOutlineCurrencyDollar,
    HiOutlineArrowTrendingUp
} from "react-icons/hi2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { toast } from "react-hot-toast";

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export function PeriodIncomeClientPeriodRevenuePage() {
    const [loading, setLoading] = useState(true);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [dateRange, setDateRange] = useState({
        startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    });

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });

            const res = await fetch(`/api/finance/stats?${queryParams.toString()}`);
            const data = await res.json();

            if (data && typeof data.totalRevenue === 'number') {
                setTotalRevenue(data.totalRevenue);
            } else {
                console.error("Invalid API response for period revenue:", data);
                setTotalRevenue(0);
            }

        } catch (error) {
            console.error("Failed to fetch revenue", error);
            toast.error("Gagal memuat data pendapatan");
            setTotalRevenue(0);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-gray-900/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineCalendar className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        Pendapatan Periode
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Laporan pendapatan berdasarkan rentang waktu
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
                    <input
                        type="date"
                        value={dateRange.startDate}
                        onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                        className="px-3 py-1.5 bg-transparent text-sm outline-none text-gray-700 dark:text-gray-200"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                        type="date"
                        value={dateRange.endDate}
                        onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                        className="px-3 py-1.5 bg-transparent text-sm outline-none text-gray-700 dark:text-gray-200"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <HiOutlineCurrencyDollar className="w-24 h-24 text-indigo-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Pendapatan Periode Ini</p>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                            Rp {totalRevenue.toLocaleString('id-ID')}
                        </h3>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Grafik Pendapatan</h3>
                <div className="h-[300px] w-full flex items-center justify-center text-gray-400">
                    {/* Placeholder for bar chart */}
                    <p>Grafik detail per hari/bulan akan muncul di sini</p>
                </div>
            </div>
        </div>
    );
}

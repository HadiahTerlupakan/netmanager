"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
    HiOutlineDocumentText,
    HiOutlineCurrencyDollar,
    HiOutlineArrowTrendingUp,
    HiArrowDownTray
} from "react-icons/hi2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { toast } from "react-hot-toast";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export default function DailyRevenuePage() {
    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState<any[]>([]);
    const [totalRevenue, setTotalRevenue] = useState(0);

    useEffect(() => {
        fetchDailyRevenue();
    }, []);

    const fetchDailyRevenue = async () => {
        try {
            setLoading(true);
            const today = new Date();
            const queryParams = new URLSearchParams({
                startDate: format(today, 'yyyy-MM-dd'),
                endDate: format(today, 'yyyy-MM-dd'),
                type: 'daily'
            });

            const res = await fetch(`/api/finance/stats?${queryParams.toString()}`);
            const data = await res.json();

            if (data && typeof data.totalRevenue === 'number') {
                setTotalRevenue(data.totalRevenue);
            } else {
                console.error("Invalid API response for daily revenue:", data);
                setTotalRevenue(0);
            }

        } catch (error) {
            console.error("Failed to fetch daily revenue", error);
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
                        <HiOutlineDocumentText className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        Pendapatan Harian
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Laporan pendapatan untuk hari ini ({format(new Date(), "dd MMMM yyyy", { locale: id })})
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchDailyRevenue}
                        className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm text-sm font-medium"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Revenue Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <HiOutlineCurrencyDollar className="w-24 h-24 text-indigo-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Pendapatan Hari Ini</p>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                            Rp {totalRevenue.toLocaleString('id-ID')}
                        </h3>
                        <div className="mt-4 flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 w-fit px-2 py-1 rounded-full">
                            <HiOutlineArrowTrendingUp className="w-4 h-4" />
                            <span>Update Terkini</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Tren Pendapatan Hari Ini</h3>
                <div className="h-[300px] w-full flex items-center justify-center text-gray-400">
                    {/* Placeholder for hourly chart if data available */}
                    <p>Grafik per jam akan muncul di sini (Data per jam belum tersedia)</p>
                </div>
            </div>
        </div>
    );
}

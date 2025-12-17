"use client";

import { useState, useEffect } from "react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { id } from "date-fns/locale";
import {
    HiOutlineChartBar,
    HiOutlineCurrencyDollar,
    HiOutlineCreditCard,
    HiOutlineBanknotes
} from "react-icons/hi2";
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { toast } from "react-hot-toast";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function LabaRugiPage() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        paymentCount: 0,
        expenseCount: 0,
        history: [] as any[]
    });

    const [dateRange, setDateRange] = useState({
        startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    });

    useEffect(() => {
        fetchStats();
    }, [dateRange]);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });

            const res = await fetch(`/api/finance/stats?${queryParams.toString()}`);
            const data = await res.json();

            if (data && typeof data.totalRevenue === 'number') {
                setStats({
                    totalRevenue: data.totalRevenue || 0,
                    totalExpenses: data.totalExpenses || 0,
                    netProfit: data.netProfit || 0,
                    paymentCount: data.details?.paymentCount || 0,
                    expenseCount: data.details?.expenseCount || 0,
                    history: data.history || []
                });
            } else {
                console.error("Invalid API response for laba rugi:", data);
                setStats({ totalRevenue: 0, totalExpenses: 0, netProfit: 0, paymentCount: 0, expenseCount: 0, history: [] });
            }
        } catch (error) {
            toast.error("Gagal memuat data keuangan");
            setStats({ totalRevenue: 0, totalExpenses: 0, netProfit: 0, paymentCount: 0, expenseCount: 0, history: [] });
        } finally {
            setLoading(false);
        }
    };

    const chartData = {
        labels: ['Pendapatan', 'Pengeluaran'],
        datasets: [
            {
                data: [stats.totalRevenue, stats.totalExpenses],
                backgroundColor: [
                    'rgba(79, 70, 229, 0.8)', // Indigo
                    'rgba(225, 29, 72, 0.8)', // Rose
                ],
                borderColor: [
                    'rgba(79, 70, 229, 1)',
                    'rgba(225, 29, 72, 1)',
                ],
                borderWidth: 1,
            },
        ],
    };

    return (
        <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-gray-900/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineChartBar className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        Laporan Laba Rugi
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Analisis profitabilitas periode ini
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
                {/* Revenue Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                            <HiOutlineCurrencyDollar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Pendapatan</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Rp {stats.totalRevenue.toLocaleString('id-ID')}</h3>
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full w-fit">
                                {stats.paymentCount} Transaksi Masuk
                            </p>
                        </div>
                    </div>
                </div>

                {/* Expense Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-600 dark:text-rose-400">
                            <HiOutlineCreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Pengeluaran</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Rp {stats.totalExpenses.toLocaleString('id-ID')}</h3>
                            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full w-fit">
                                {stats.expenseCount} Transaksi Keluar
                            </p>
                        </div>
                    </div>
                </div>

                {/* Net Profit Card */}
                <div className={`rounded-2xl p-6 shadow-sm border ${stats.netProfit >= 0 ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${stats.netProfit >= 0 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'}`}>
                            <HiOutlineBanknotes className="w-6 h-6" />
                        </div>
                        <div>
                            <p className={`text-sm font-medium ${stats.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>Laba Bersih (Net Profit)</p>
                            <h3 className={`text-2xl font-bold mt-1 ${stats.netProfit >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>
                                Rp {stats.netProfit.toLocaleString('id-ID')}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Perbandingan Pendapatan vs Pengeluaran</h3>
                    <div className="h-[300px] w-full flex justify-center">
                        <Doughnut data={chartData} options={{ maintainAspectRatio: false }} />
                    </div>
                </div>
                {/* Add more detailed breakdown or table here if needed */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Detail Bulanan</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Periode</th>
                                    <th scope="col" className="px-6 py-3">Transaksi</th>
                                    <th scope="col" className="px-6 py-3">Gross Income</th>
                                    <th scope="col" className="px-6 py-3">- Fee Seller</th>
                                    <th scope="col" className="px-6 py-3">- PPN</th>
                                    <th scope="col" className="px-6 py-3">- Pengeluaran</th>
                                    <th scope="col" className="px-6 py-3">NET PROFIT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.history && stats.history.length > 0 ? (
                                    stats.history.map((month: any, index: number) => (
                                        <tr key={index} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                                {format(new Date(month.period), "MMMM yyyy", { locale: id })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                                                    {month.transactionCount} TRX
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">Rp {month.revenue.toLocaleString('id-ID')}</td>
                                            <td className="px-6 py-4">Rp 0</td>
                                            <td className="px-6 py-4">Rp {month.tax?.toLocaleString('id-ID') || 0}</td>
                                            <td className="px-6 py-4">Rp {month.expenses.toLocaleString('id-ID')}</td>
                                            <td className={`px-6 py-4 font-bold ${month.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                Rp {month.netProfit.toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-4 text-center">
                                            Tidak ada data untuk periode ini
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

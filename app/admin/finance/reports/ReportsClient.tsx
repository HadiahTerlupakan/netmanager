'use client'

import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js'
import { Pie, Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

export default function ReportsClient() {
    const [capexOpex, setCapexOpex] = useState<any>(null)
    const [taxReport, setTaxReport] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [resCapex, resTax] = await Promise.all([
                fetch('/api/finance/reports?type=CAPEX_OPEX'),
                fetch('/api/finance/reports?type=TAX')
            ])
            
            if (resCapex.ok) setCapexOpex(await resCapex.json())
            if (resTax.ok) setTaxReport(await resTax.json())
        } catch (error) {
            console.error('Error fetching reports', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div>Loading reports...</div>

    const capexChartData = {
        labels: ['Capex (Modal)', 'Opex (Operasional)', 'Lainnya'],
        datasets: [
            {
                data: [capexOpex?.CAPITAL || 0, capexOpex?.OPERATIONAL || 0, capexOpex?.OTHER || 0],
                backgroundColor: [
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(201, 203, 207, 0.8)',
                ],
                borderColor: [
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(201, 203, 207, 1)',
                ],
                borderWidth: 1,
            },
        ],
    }

    // Format currency
     const formatRp = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

    // KPI Calc
    const totalCapex = capexOpex?.CAPITAL || 0
    const totalOpex = capexOpex?.OPERATIONAL || 0
    const totalPPN = taxReport?.totalPPN || 0

    return (
        <div className="max-w-7xl mx-auto">
             {/* Page Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Laporan & Analisis</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Ringkasan performa finansial, capex vs opex, dan laporan pajak.
                    </p>
                </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Capex (Modal)</dt>
                        <dd className="mt-1 text-3xl font-semibold text-blue-600 dark:text-blue-400">{formatRp(totalCapex)}</dd>
                        <dd className="mt-2 text-sm text-gray-500 dark:text-gray-400">Aset & Investasi</dd>
                    </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Opex (Ops)</dt>
                        <dd className="mt-1 text-3xl font-semibold text-red-600 dark:text-red-400">{formatRp(totalOpex)}</dd>
                        <dd className="mt-2 text-sm text-gray-500 dark:text-gray-400">Biaya Operasional Rutin</dd>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                         <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Input VAT (Pajak)</dt>
                        <dd className="mt-1 text-3xl font-semibold text-purple-600 dark:text-purple-400">{formatRp(totalPPN)}</dd>
                        <dd className="mt-2 text-sm text-gray-500 dark:text-gray-400">Potensi Kredit Pajak</dd>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* CAPEX vs OPEX */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
                    <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                            Komposisi Pengeluaran
                        </h3>
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            Year to Date
                        </span>
                    </div>
                    <div className="p-6">
                        <div className="h-64 flex justify-center">
                             <Pie data={capexChartData} options={{ maintainAspectRatio: false }} />
                        </div>
                        <div className="mt-6 space-y-4">
                            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                                    Capex
                                </span>
                                <span className="font-bold text-gray-900 dark:text-white">{formatRp(totalCapex)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                    Opex
                                </span>
                                <span className="font-bold text-gray-900 dark:text-white">{formatRp(totalOpex)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TAX REPORT */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg flex flex-col">
                    <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                            Rincian Pajak Masukan
                        </h3>
                    </div>
                    <div className="flex-1 overflow-auto max-h-[500px]">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PO</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PPN</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {taxReport?.details?.map((po: any) => (
                                    <tr key={po.poNumber} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white font-mono">{po.poNumber}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 max-w-[150px] truncate" title={po.supplier?.name}>{po.supplier?.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-mono font-medium">{formatRp(po.ppnAmount)}</td>
                                    </tr>
                                ))}
                                {!taxReport?.details?.length && (
                                    <tr><td colSpan={3} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Data pajak belum tersedia</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

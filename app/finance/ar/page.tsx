"use client"

import { useEffect, useState } from 'react'
import { useFinance } from '@/hooks/useFinance'
import {
    HiOutlineBanknotes,
    HiArrowPath,
    HiBars3,
    HiOutlineChartBar,
    HiOutlineClock,
    HiOutlineExclamationCircle,
    HiOutlineDocumentArrowDown,
    HiOutlinePaperAirplane,
    HiXMark,
} from 'react-icons/hi2'

const formatRupiah = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? Number(amount) : amount
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(numAmount)
}

const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

export default function ARPage() {
    const { data: financeUser, loading: userLoading } = useFinance()
    const [agingReport, setAgingReport] = useState<any>(null)
    const [outstandingList, setOutstandingList] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [selectedBucket, setSelectedBucket] = useState<string>('ALL')
    const [sendModalOpen, setSendModalOpen] = useState(false)
    const [selectedTagihan, setSelectedTagihan] = useState<any>(null)
    const [sendChannel, setSendChannel] = useState<'EMAIL' | 'WHATSAPP' | 'BOTH'>('EMAIL')
    const [sending, setSending] = useState(false)

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('finance_token')
            if (!token) return

            setLoading(true)

            // Fetch aging report
            const agingRes = await fetch('/api/finance/ar/aging-report', {
                headers: { 'x-finance-token': token },
            })
            if (agingRes.ok) {
                const data = await agingRes.json()
                setAgingReport(data)
            }

            // Fetch outstanding invoices
            const filter = selectedBucket !== 'ALL' ? `&agingBucket=${selectedBucket}` : ''
            const outstandingRes = await fetch(
                `/api/finance/ar/outstanding?limit=50${filter}`,
                {
                    headers: { 'x-finance-token': token },
                }
            )
            if (outstandingRes.ok) {
                const data = await outstandingRes.json()
                setOutstandingList(data.data)
            }
        } catch (error) {
            console.error('Error fetching AR data:', error)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        if (financeUser) {
            fetchData()
        }
    }, [financeUser, selectedBucket])

    const handleRefresh = () => {
        setRefreshing(true)
        fetchData()
    }

    const handleDownloadPDF = async (tagihanId: string) => {
        try {
            const token = localStorage.getItem('finance_token')
            const response = await fetch(`/api/finance/invoice/${tagihanId}/pdf`, {
                headers: { 'x-finance-token': token || '' }
            })

            if (response.ok) {
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `Invoice-${tagihanId}.pdf`
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)
            } else {
                alert('Failed to download PDF')
            }
        } catch (error) {
            console.error('Error downloading PDF:', error)
            alert('Error downloading PDF')
        }
    }

    const handleOpenSendModal = (tagihan: any) => {
        setSelectedTagihan(tagihan)
        setSendModalOpen(true)
    }

    const handleSendInvoice = async () => {
        if (!selectedTagihan) return

        try {
            setSending(true)
            const token = localStorage.getItem('finance_token')

            const response = await fetch('/api/finance/invoice/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-finance-token': token || ''
                },
                body: JSON.stringify({
                    tagihanId: selectedTagihan.id,
                    channel: sendChannel
                })
            })

            const result = await response.json()

            if (result.success) {
                alert(`Invoice sent successfully via ${sendChannel}!`)
                setSendModalOpen(false)
            } else {
                alert(`Failed to send invoice: ${result.message}`)
            }
        } catch (error) {
            console.error('Error sending invoice:', error)
            alert('Error sending invoice')
        } finally {
            setSending(false)
        }
    }

    if (userLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="text-center">
                    <HiArrowPath className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto mb-4" />
                    <div className="text-gray-500 dark:text-gray-400">Memuat data...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
            {/* Header */}
            <header className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    if ((window as any).toggleFinanceSidebar) {
                                        ; (window as any).toggleFinanceSidebar()
                                    }
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden"
                            >
                                <HiBars3 className="w-6 h-6" />
                            </button>
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                <HiOutlineBanknotes className="w-6 h-6" />
                            </div>
                            <h1 className="text-xl font-bold">Accounts Receivable</h1>
                        </div>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <HiArrowPath className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="px-4 py-4 md:px-6 lg:px-8">
                {/* Aging Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    {/* Total Outstanding */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                    Total Outstanding
                                </p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {agingReport ? formatRupiah(agingReport.totalOutstanding) : formatRupiah(0)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {agingReport ? `${agingReport.totalCustomers} pelanggan` : '...'}
                                </p>
                            </div>
                            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <HiOutlineChartBar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                    </div>

                    {/* Current (0-30 days) */}
                    <div
                        onClick={() => setSelectedBucket('CURRENT')}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 cursor-pointer hover:shadow-lg transition-shadow"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                    Current (0-30)
                                </p>
                                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {agingReport ? formatRupiah(agingReport.current) : formatRupiah(0)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {agingReport && agingReport.breakdown
                                        ? `${agingReport.breakdown[0].percentage.toFixed(1)}%`
                                        : '...'}
                                </p>
                            </div>
                            <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <HiOutlineClock className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                    </div>

                    {/* Overdue 1 month */}
                    <div
                        onClick={() => setSelectedBucket('OVERDUE_30')}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 cursor-pointer hover:shadow-lg transition-shadow"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                    Overdue 1 Month
                                </p>
                                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                    {agingReport ? formatRupiah(agingReport.overdue30) : formatRupiah(0)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {agingReport && agingReport.breakdown
                                        ? `${agingReport.breakdown[1].percentage.toFixed(1)}%`
                                        : '...'}
                                </p>
                            </div>
                            <div className="p-2.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                <HiOutlineExclamationCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                            </div>
                        </div>
                    </div>

                    {/* Overdue 2 months */}
                    <div
                        onClick={() => setSelectedBucket('OVERDUE_60')}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 cursor-pointer hover:shadow-lg transition-shadow"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                    Overdue 2 Months
                                </p>
                                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                    {agingReport ? formatRupiah(agingReport.overdue60) : formatRupiah(0)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {agingReport && agingReport.breakdown
                                        ? `${agingReport.breakdown[2].percentage.toFixed(1)}%`
                                        : '...'}
                                </p>
                            </div>
                            <div className="p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                                <HiOutlineExclamationCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                            </div>
                        </div>
                    </div>

                    {/* Overdue 3+ months */}
                    <div
                        onClick={() => setSelectedBucket('OVERDUE_90_PLUS')}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 cursor-pointer hover:shadow-lg transition-shadow"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                    Overdue 3+ Months
                                </p>
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                    {agingReport ? formatRupiah(agingReport.overdue90) : formatRupiah(0)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {agingReport && agingReport.breakdown
                                        ? `${agingReport.breakdown[3].percentage.toFixed(1)}%`
                                        : '...'}
                                </p>
                            </div>
                            <div className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                <HiOutlineExclamationCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filter indicator */}
                {selectedBucket !== 'ALL' && (
                    <div className="mb-4">
                        <button
                            onClick={() => setSelectedBucket('ALL')}
                            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                            Filter: {selectedBucket} - Click to show all
                        </button>
                    </div>
                )}

                {/* Outstanding Invoices List */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md">
                    <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Outstanding Invoices
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Daftar tagihan yang belum dibayar
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Pelanggan
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        No. Tagihan
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Paket
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Jatuh Tempo
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Days Overdue
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Amount
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {outstandingList.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                            Tidak ada tagihan outstanding
                                        </td>
                                    </tr>
                                ) : (
                                    outstandingList.map((item: any) => (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {item.pelangganNama}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {item.pelangganNoTelp || item.pelangganEmail || '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900 dark:text-white">{item.noTagihan}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900 dark:text-white">{item.paketName}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900 dark:text-white">
                                                    {formatDate(item.jatuhTempo)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className={`text-sm font-medium ${item.daysOverdue === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {item.daysOverdue} hari
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {formatRupiah(item.total)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span
                                                    className={`px-2 py-1 text-xs font-medium rounded-full ${item.agingBucket === 'CURRENT'
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                                        : item.agingBucket === 'OVERDUE_30'
                                                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                                            : item.agingBucket === 'OVERDUE_60'
                                                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                                                                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                                        }`}
                                                >
                                                    {item.agingBucket}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleDownloadPDF(item.id)}
                                                        className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                        title="Download PDF"
                                                    >
                                                        <HiOutlineDocumentArrowDown className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenSendModal(item)}
                                                        className="p-2 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors"
                                                        title="Send Invoice"
                                                    >
                                                        <HiOutlinePaperAirplane className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Send Invoice Modal */}
            {sendModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Send Invoice
                            </h3>
                            <button
                                onClick={() => setSendModalOpen(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <HiXMark className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {selectedTagihan && (
                                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                    <div className="text-sm space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500 dark:text-gray-400">Customer:</span>
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {selectedTagihan.pelangganNama}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500 dark:text-gray-400">Invoice:</span>
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {selectedTagihan.noTagihan}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {formatRupiah(selectedTagihan.total)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                    Select Delivery Channel
                                </label>
                                <div className="space-y-2">
                                    <label className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <input
                                            type="radio"
                                            name="channel"
                                            value="EMAIL"
                                            checked={sendChannel === 'EMAIL'}
                                            onChange={(e) => setSendChannel(e.target.value as any)}
                                            className="mr-3"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900 dark:text-white">Email</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {selectedTagihan?.pelangganEmail || 'No email available'}
                                            </div>
                                        </div>
                                    </label>

                                    <label className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <input
                                            type="radio"
                                            name="channel"
                                            value="WHATSAPP"
                                            checked={sendChannel === 'WHATSAPP'}
                                            onChange={(e) => setSendChannel(e.target.value as any)}
                                            className="mr-3"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900 dark:text-white">WhatsApp</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {selectedTagihan?.pelangganNoTelp || 'No phone available'}
                                            </div>
                                        </div>
                                    </label>

                                    <label className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <input
                                            type="radio"
                                            name="channel"
                                            value="BOTH"
                                            checked={sendChannel === 'BOTH'}
                                            onChange={(e) => setSendChannel(e.target.value as any)}
                                            className="mr-3"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900 dark:text-white">Both Email & WhatsApp</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                Send via both channels
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => setSendModalOpen(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendInvoice}
                                disabled={sending}
                                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                                {sending ? (
                                    <>
                                        <HiArrowPath className="w-4 h-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <HiOutlinePaperAirplane className="w-4 h-4" />
                                        Send Invoice
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

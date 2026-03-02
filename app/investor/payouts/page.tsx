'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import InvestorBottomNav from '../components/InvestorBottomNav'
import PageLoader from '@/components/ui/PageLoader'
import { HiOutlineCurrencyDollar } from 'react-icons/hi2'
import { formatCurrency } from '@/lib/utils'

interface Payout {
    id: string;
    amount: string;
    date: string;
    bankName: string | null;
    accountNumber: string | null;
    accountName: string | null;
    reference: string | null;
    notes: string | null;
    status: string;
}

export default function InvestorPayoutsPage() {
    const router = useRouter()
    const [payouts, setPayouts] = useState<Payout[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchPayouts = async () => {
            try {
                const res = await fetch('/api/investor/payouts')
                if (!res.ok) {
                    if (res.status === 401) router.push('/investor/login')
                    return
                }
                const response = await res.json()
                setPayouts(response.data || [])
            } catch (error) {
                console.error("Failed to fetch payouts", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchPayouts()
    }, [router])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#121212] flex items-center justify-center">
                <PageLoader variant="page" message="Memuat Riwayat Payout..." />
                <InvestorBottomNav />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#121212] pb-24">
            <div className="bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 shadow-sm sticky top-0 z-40">
                <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Riwayat Payout</h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Daftar pembayaran profit Anda</p>
                    </div>
                    <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-xl">
                        <HiOutlineCurrencyDollar className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                </div>
            </div>

            <main className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
                {payouts.length > 0 ? (
                    payouts.map((p) => (
                        <div key={p.id} className="bg-white dark:bg-neutral-900 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-neutral-800 shadow-sm relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Payout</span>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                                        Rp {formatCurrency(Number(p.amount))}
                                    </h3>
                                </div>
                                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full tracking-wider ${p.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'}`}>
                                    {p.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-3 border-t border-gray-100 dark:border-neutral-800">
                                <div>
                                    <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">Tanggal</span>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        {new Date(p.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">Tujuan</span>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        {p.bankName ? `${p.bankName} - ${p.accountNumber || ''}` : 'Transfer Bank'}
                                    </span>
                                </div>
                                {p.notes && (
                                    <div className="col-span-2">
                                        <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">Catatan</span>
                                        <p className="text-xs text-gray-600 dark:text-gray-300">
                                            {p.notes}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 px-4 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm">
                        <div className="bg-gray-50 dark:bg-neutral-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <HiOutlineCurrencyDollar className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2">Belum Ada Payout</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                            Saat ini belum ada riwayat pembayaran profit yang tercatat di akun Anda.
                        </p>
                    </div>
                )}
            </main>

            <InvestorBottomNav />
        </div>
    )
}

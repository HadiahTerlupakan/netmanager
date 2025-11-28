"use client"

import { useEffect, useState } from 'react'
import { useFinance } from '@/hooks/useFinance'
import {
    HiOutlineArrowPath,
    HiBars3,
    HiOutlineBanknotes,
    HiOutlineCloudArrowUp,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
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

export default function BankReconciliationPage() {
    const { data: financeUser, loading: userLoading } = useFinance()
    const [bankAccounts, setBankAccounts] = useState<any[]>([])
    const [selectedAccount, setSelectedAccount] = useState<string>('')
    const [unreconciled, setUnreconciled] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [importing, setImporting] = useState(false)

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('finance_token')
            if (!token) return

            setLoading(true)

            // Fetch bank accounts
            const accountsRes = await fetch('/api/finance/bank/accounts?active=true', {
                headers: { 'x-finance-token': token },
            })
            if (accountsRes.ok) {
                const data = await accountsRes.json()
                setBankAccounts(data.data)
                if (data.data.length > 0 && !selectedAccount) {
                    setSelectedAccount(data.data[0].id)
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchUnreconciled = async (accountId: string) => {
        try {
            const token = localStorage.getItem('finance_token')
            if (!token) return

            const res = await fetch(`/api/finance/bank/unreconciled?bankAccountId=${accountId}`, {
                headers: { 'x-finance-token': token },
            })
            if (res.ok) {
                const data = await res.json()
                setUnreconciled(data.data)
            }
        } catch (error) {
            console.error('Error fetching unreconciled:', error)
        }
    }

    useEffect(() => {
        if (financeUser) {
            fetchData()
        }
    }, [financeUser])

    useEffect(() => {
        if (selectedAccount) {
            fetchUnreconciled(selectedAccount)
        }
    }, [selectedAccount])

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !selectedAccount) return

        setImporting(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('bankAccountId', selectedAccount)

            const token = localStorage.getItem('finance_token')
            const res = await fetch('/api/finance/bank/import-statement', {
                method: 'POST',
                headers: { 'x-finance-token': token || '' },
                body: formData,
            })

            if (res.ok) {
                const data = await res.json()
                alert(`✓ ${data.message}\n${data.imported} transaksi berhasil diimport`)
                fetchUnreconciled(selectedAccount)
            } else {
                const data = await res.json()
                alert(`Error: ${data.error}`)
            }
        } catch (error) {
            console.error('Error importing:', error)
            alert('Gagal mengimport file')
        } finally {
            setImporting(false)
            e.target.value = '' // Reset file input
        }
    }

    const handleAutoMatch = async (statement: any) => {
        try {
            const token = localStorage.getItem('finance_token')
            const res = await fetch('/api/finance/bank/auto-match', {
                method: 'POST',
                headers: {
                    'x-finance-token': token || '',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: statement.credit > 0 ? statement.credit : statement.debit,
                    transactionDate: statement.transactionDate,
                    description: statement.description,
                    isCredit: statement.credit > 0,
                }),
            })

            if (res.ok) {
                const data = await res.json()
                if (data.candidates.length > 0) {
                    const best = data.candidates[0]
                    const confirmMsg = `Match ditemukan!\n\nTipe: ${best.type}\nJumlah: ${formatRupiah(
                        best.amount
                    )}\nDeskripsi: ${best.description}\nConfidence: ${(best.confidence * 100).toFixed(
                        1
                    )}%\n\nMatch otomatis?`

                    if (confirm(confirmMsg)) {
                        await confirmMatch(statement.id, best)
                    }
                } else {
                    alert('Tidak ada match yang ditemukan')
                }
            }
        } catch (error) {
            console.error('Error auto-matching:', error)
        }
    }

    const confirmMatch = async (bankStatementId: string, match: any) => {
        try {
            const token = localStorage.getItem('finance_token')
            const res = await fetch('/api/finance/bank/match-transaction', {
                method: 'POST',
                headers: {
                    'x-finance-token': token || '',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    bankStatementId,
                    matchType: match.type === 'TAGIHAN' || match.type === 'PEMASUKAN' ? 'PAYMENT_IN' : 'PAYMENT_OUT',
                    entityType: match.type,
                    entityId: match.id,
                    confidence: match.confidence,
                }),
            })

            if (res.ok) {
                alert('✓ Transaksi berhasil di-match!')
                fetchUnreconciled(selectedAccount)
            }
        } catch (error) {
            console.error('Error confirming match:', error)
        }
    }

    if (userLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="text-center">
                    <HiOutlineArrowPath className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto mb-4" />
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
                            <h1 className="text-xl font-bold">Bank Reconciliation</h1>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="px-4 py-4 md:px-6 lg:px-8">
                {/* Bank Account Selector + Import */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Pilih Bank Account
                            </label>
                            <select
                                value={selectedAccount}
                                onChange={(e) => setSelectedAccount(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                {bankAccounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.bankName} - {account.accountName} ({account.accountNumber})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Import Bank Statement (CSV)
                            </label>
                            <label className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer">
                                <HiOutlineCloudArrowUp className="w-5 h-5" />
                                {importing ? 'Importing...' : 'Upload CSV'}
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleImport}
                                    disabled={importing || !selectedAccount}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>
                    <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        Format CSV: Date, Description, Reference, Debit, Credit, Balance
                    </div>
                </div>

                {/* Unreconciled Transactions */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md">
                    <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Unreconciled Transactions
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {unreconciled.length} transaksi belum di-reconcile
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Tanggal
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Deskripsi
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Debit
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Credit
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Balance
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {unreconciled.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                            Semua transaksi sudah di-reconcile ✓
                                        </td>
                                    </tr>
                                ) : (
                                    unreconciled.map((stmt: any) => (
                                        <tr key={stmt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {formatDate(stmt.transactionDate)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900 dark:text-white">{stmt.description}</div>
                                                {stmt.reference && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Ref: {stmt.reference}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600 dark:text-red-400">
                                                {stmt.debit > 0 ? formatRupiah(stmt.debit) : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 dark:text-green-400">
                                                {stmt.credit > 0 ? formatRupiah(stmt.credit) : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                                                {formatRupiah(stmt.balance)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => handleAutoMatch(stmt)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
                                                >
                                                    <HiOutlineCheckCircle className="w-4 h-4" />
                                                    Auto-Match
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main >
        </div >
    )
}

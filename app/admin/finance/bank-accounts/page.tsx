"use client"

import { useState, useEffect } from 'react'
import { HiPlus, HiPencil, HiTrash, HiCheckCircle, HiXCircle } from 'react-icons/hi2'

const formatRupiah = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? Number(amount) : amount
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(numAmount)
}

export default function BankAccountsPage() {
    const [accounts, setAccounts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingAccount, setEditingAccount] = useState<any>(null)
    const [formData, setFormData] = useState({
        accountName: '',
        bankName: '',
        accountNumber: '',
        accountType: 'CHECKING',
        balance: '0',
        currency: 'IDR',
        description: '',
        isActive: true,
    })

    const fetchAccounts = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/finance/bank/accounts', {
                credentials: 'include', // Ensure cookies are sent
            })
            if (res.ok) {
                const data = await res.json()
                setAccounts(data.data)
            }
        } catch (error) {
            console.error('Error fetching accounts:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAccounts()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            if (editingAccount) {
                // Update
                const res = await fetch(`/api/finance/bank/accounts/${editingAccount.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify(formData),
                })

                if (res.ok) {
                    alert('✓ Bank account updated successfully!')
                    resetForm()
                    fetchAccounts()
                }
            } else {
                // Create
                const res = await fetch('/api/finance/bank/accounts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify(formData),
                })

                if (res.ok) {
                    alert('✓ Bank account created successfully!')
                    resetForm()
                    fetchAccounts()
                }
            }
        } catch (error) {
            console.error('Error saving account:', error)
            alert('Failed to save account')
        }
    }

    const handleEdit = (account: any) => {
        setEditingAccount(account)
        setFormData({
            accountName: account.accountName,
            bankName: account.bankName,
            accountNumber: account.accountNumber,
            accountType: account.accountType,
            balance: account.balance,
            currency: account.currency,
            description: account.description || '',
            isActive: account.isActive,
        })
        setShowModal(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this bank account?')) return

        try {
            const res = await fetch(`/api/finance/bank/accounts/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            })

            if (res.ok) {
                alert('✓ Bank account deleted successfully!')
                fetchAccounts()
            }
        } catch (error) {
            console.error('Error deleting account:', error)
            alert('Failed to delete account')
        }
    }

    const resetForm = () => {
        setShowModal(false)
        setEditingAccount(null)
        setFormData({
            accountName: '',
            bankName: '',
            accountNumber: '',
            accountType: 'CHECKING',
            balance: '0',
            currency: 'IDR',
            description: '',
            isActive: true,
        })
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bank Accounts</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Manage bank accounts for reconciliation
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                    <HiPlus className="w-5 h-5" />
                    Add Bank Account
                </button>
            </div>

            {/* Bank Accounts Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Bank Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Account Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Account Number
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Type
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Balance
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
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                    Loading...
                                </td>
                            </tr>
                        ) : accounts.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                    No bank accounts found. Click "Add Bank Account" to create one.
                                </td>
                            </tr>
                        ) : (
                            accounts.map((account) => (
                                <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {account.bankName}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 dark:text-white">{account.accountName}</div>
                                        {account.description && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{account.description}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 dark:text-white font-mono">
                                            {account.accountNumber}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded">
                                            {account.accountType}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {formatRupiah(account.balance)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        {account.isActive ? (
                                            <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
                                                <HiCheckCircle className="w-5 h-5" />
                                                <span className="text-xs font-medium">Active</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                                                <HiXCircle className="w-5 h-5" />
                                                <span className="text-xs font-medium">Inactive</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleEdit(account)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                title="Edit"
                                            >
                                                <HiPencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(account.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <HiTrash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}
                            </h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Bank Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.bankName}
                                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                        placeholder="e.g. BCA, Mandiri, BRI"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Account Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.accountName}
                                        onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                                        placeholder="e.g. BCA Operasional"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Account Number *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.accountNumber}
                                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                                        placeholder="1234567890"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Account Type
                                    </label>
                                    <select
                                        value={formData.accountType}
                                        onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value="CHECKING">Checking</option>
                                        <option value="SAVINGS">Savings</option>
                                        <option value="E_WALLET">E-Wallet</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Initial Balance
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.balance}
                                        onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                                        placeholder="0"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Currency
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.currency}
                                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                        placeholder="IDR"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Optional description"
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                />
                                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Active
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                >
                                    {editingAccount ? 'Update' : 'Create'} Account
                                </button>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

"use client"

import { useState } from 'react'
import {
    HiOutlinePlus,
    HiOutlineBanknotes,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlinePencil,
    HiOutlineTrash,
} from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import UnmatchedMutationsList from './UnmatchedMutationsList'
import { useManualTransferAccounts } from '../hooks/useManualTransferAccounts'
import type { CompanyBankAccount, ManualTransferFormValues } from '../hooks/useManualTransferAccounts'

export default function ManualTransferTab() {
    const {
        accounts,
        loading,
        upsertAccount,
        deleteAccount,
        toggleAccount,
    } = useManualTransferAccounts()
    const [modalOpen, setModalOpen] = useState(false)
    const [editingAccount, setEditingAccount] = useState<CompanyBankAccount | null>(null)
    const [formData, setFormData] = useState<ManualTransferFormValues>({
        bankName: '',
        accountNumber: '',
        accountName: '',
        description: '',
        isActive: true,
        priority: 1,
    })

    const handleOpenModal = (account?: CompanyBankAccount) => {
        if (account) {
            setEditingAccount(account)
            setFormData({
                bankName: account.bankName,
                accountNumber: account.accountNumber,
                accountName: account.accountName,
                description: account.description || '',
                isActive: account.isActive,
                priority: account.priority,
            })
        } else {
            setEditingAccount(null)
            setFormData({
                bankName: '',
                accountNumber: '',
                accountName: '',
                description: '',
                isActive: true,
                priority: 1,
            })
        }
        setModalOpen(true)
    }

    const handleSave = async () => {
        const result = await upsertAccount(formData, editingAccount?.id ?? undefined)

        if (result.success) {
            alert(editingAccount ? 'Rekening berhasil diupdate!' : 'Rekening berhasil ditambahkan!')
            setModalOpen(false)
        } else {
            alert(`Gagal menyimpan: ${result.message ?? 'Tidak ada detail tambahan.'}`)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Yakin ingin menghapus rekening ini?')) return

        const result = await deleteAccount(id)
        if (result.success) {
            alert('Rekening berhasil dihapus!')
        } else {
            alert(`Gagal menghapus rekening: ${result.message ?? 'Tidak ada detail tambahan.'}`)
        }
    }

    const handleToggleActive = async (account: CompanyBankAccount) => {
        const result = await toggleAccount(account)
        if (!result.success) {
            console.error('Error toggling status:', result.message)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <PageLoader />
            </div>
        )
    }

    return (
        <div>
            {/* Header / Add Button */}
            <div className="flex justify-end mb-6">
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <HiOutlinePlus className="w-5 h-5" />
                    Tambah Rekening
                </button>
            </div>

            {/* Bank Accounts List */}
            <div>
                {accounts.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center">
                        <HiOutlineBanknotes className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                            Belum ada rekening bank yang ditambahkan
                        </p>
                        <button
                            onClick={() => handleOpenModal()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Tambah Rekening Pertama
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {accounts.map((account) => (
                            <div
                                key={account.id}
                                className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border-2 border-transparent hover:border-blue-500 transition-all"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                                {account.bankName}
                                            </h3>
                                            {account.isActive ? (
                                                <HiOutlineCheckCircle className="w-5 h-5 text-green-600" />
                                            ) : (
                                                <HiOutlineXCircle className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {account.accountName}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleToggleActive(account)}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                            title={account.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                        >
                                            {account.isActive ? (
                                                <HiOutlineCheckCircle className="w-5 h-5 text-green-600" />
                                            ) : (
                                                <HiOutlineXCircle className="w-5 h-5 text-gray-400" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleOpenModal(account)}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                        >
                                            <HiOutlinePencil className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(account.id)}
                                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            <HiOutlineTrash className="w-5 h-5 text-red-600" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">No. Rekening:</span>
                                        <span className="font-medium text-gray-900 dark:text-white font-mono">
                                            {account.accountNumber}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">Priority:</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {account.priority}
                                        </span>
                                    </div>
                                    {account.description && (
                                        <div className="text-sm">
                                            <span className="text-gray-500 dark:text-gray-400">Keterangan:</span>
                                            <p className="text-gray-700 dark:text-gray-300 mt-1">{account.description}</p>
                                        </div>
                                    )}
                                </div>

                                <div className={`text-xs px-3 py-1 rounded-full inline-block ${account.isActive
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                                    }`}>
                                    {account.isActive ? 'Aktif' : 'Nonaktif'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <UnmatchedMutationsList />

            {/* Modal */}
            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingAccount ? 'Edit Rekening' : 'Tambah Rekening Baru'}
                size="lg"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Nama Bank *
                        </label>
                        <input
                            type="text"
                            value={formData.bankName}
                            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                            placeholder="BCA, BRI, Mandiri, BNI, dll"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Nomor Rekening *
                        </label>
                        <input
                            type="text"
                            value={formData.accountNumber}
                            onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                            placeholder="1234567890"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Nama Pemilik Rekening *
                        </label>
                        <input
                            type="text"
                            value={formData.accountName}
                            onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                            placeholder="PT. Nama Perusahaan"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Keterangan (Opsional)
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Informasi tambahan untuk pelanggan"
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Priority: {formData.priority}
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                            className="w-full"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Priority lebih tinggi akan tampil lebih dulu (1-10)
                        </p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div>
                            <label className="font-medium text-gray-900 dark:text-white">Status</label>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Aktifkan rekening untuk pembayaran manual
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>

                <ModalFooter>
                    <button
                        onClick={() => setModalOpen(false)}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!formData.bankName || !formData.accountNumber || !formData.accountName}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {editingAccount ? 'Update' : 'Simpan'}
                    </button>
                </ModalFooter>
            </Modal>
        </div>
    )
}

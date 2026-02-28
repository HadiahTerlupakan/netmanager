'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import PageLoader from '@/components/ui/PageLoader'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import {
    HiOutlinePlus,
    HiOutlineUsers,
    HiOutlineCheckCircle,
} from 'react-icons/hi2'

interface Investor {
    id: string
    username: string
    namaLengkap: string
    email: string | null
    phone: string | null
    perusahaan: string | null
    isActive: boolean
    createdAt: string
    _count?: {
        rabProjects: number
    }
}

export default function InvestorsClient() {
    const { hasPermission } = usePermission()
    const canCreate = hasPermission('users:create')

    const [investors, setInvestors] = useState<Investor[]>([])
    const [loading, setLoading] = useState(true)

    const [showAddModal, setShowAddModal] = useState(false)
    const [saving, setSaving] = useState(false)

    // Form state
    const [form, setForm] = useState({
        username: '',
        password: '',
        namaLengkap: '',
        email: '',
        noTelp: '',
        perusahaan: '',
    })

    const fetchInvestors = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/admin/investors`)
            const data = await res.json()

            if (res.ok) {
                setInvestors(data || [])
            } else {
                toast.error(data.message || 'Gagal memuat data investor')
            }
        } catch {
            toast.error('Terjadi kesalahan saat memuat data investor')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchInvestors() }, [fetchInvestors])

    const resetForm = () => {
        setForm({
            username: '', password: '', namaLengkap: '', email: '', noTelp: '', perusahaan: ''
        })
    }

    const handleAdd = async () => {
        if (!form.username || !form.password || !form.namaLengkap) {
            toast.error('Username, password, dan Nama Lengkap harus diisi')
            return
        }
        setSaving(true)
        try {
            const res = await fetch('/api/admin/investors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (res.ok) {
                toast.success('Investor berhasil ditambahkan')
                setShowAddModal(false)
                resetForm()
                fetchInvestors()
            } else {
                toast.error(data.message || 'Gagal menambahkan investor')
            }
        } catch {
            toast.error('Terjadi kesalahan')
        } finally {
            setSaving(false)
        }
    }

    const columns: Column<Investor>[] = [
        {
            key: 'namaLengkap',
            header: 'Investor',
            priority: 'primary',
            render: (inv) => (
                <div className="flex items-center gap-3">
                    <div className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-linear-to-br from-emerald-500 to-teal-600">
                        <span className="text-white font-bold">{inv.namaLengkap.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {inv.namaLengkap}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">@{inv.username}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'perusahaan',
            header: 'Institusi/Perusahaan',
            priority: 'secondary',
            render: (inv) => (
                <span className="text-sm text-gray-600 dark:text-gray-400">{inv.perusahaan || '-'}</span>
            )
        },
        {
            key: 'projects',
            header: 'Proyek Didanai',
            priority: 'primary',
            render: (inv) => (
                <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{inv._count?.rabProjects || 0} Proyek</span>
            )
        },
        {
            key: 'isActive',
            header: 'Status',
            priority: 'primary',
            render: (inv) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${inv.isActive
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                    {inv.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
            )
        },
    ]

    const renderFormFields = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username *</label>
                <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, "") }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="investor1"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password *</label>
                <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="••••••••"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap / PIC *</label>
                <input
                    type="text"
                    value={form.namaLengkap}
                    onChange={(e) => setForm(f => ({ ...f, namaLengkap: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Nama lengkap"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Institusi / Perusahaan (Opsional)</label>
                <input
                    type="text"
                    value={form.perusahaan}
                    onChange={(e) => setForm(f => ({ ...f, perusahaan: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="PT Investor Kapital"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="email@contoh.com"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No. Handphone</label>
                <input
                    type="text"
                    value={form.noTelp}
                    onChange={(e) => setForm(f => ({ ...f, noTelp: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="08xxxxxxxxxx"
                />
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Investor</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Kelola data investor untuk Rencana Anggaran Biaya</p>
                </div>
                {canCreate && (
                    <button
                        onClick={() => { resetForm(); setShowAddModal(true) }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors shadow-sm"
                    >
                        <HiOutlinePlus className="w-5 h-5 text-white" />
                        <span className="text-white">Tambah Investor</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 rounded-lg">
                            <HiOutlineCheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{investors.filter(i => i.isActive).length}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Investor Aktif</p>
                        </div>
                    </div>
                </div>
                <div className="bg-gradient-to-r from-indigo-50 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/10 rounded-lg">
                            <HiOutlineUsers className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{investors.length}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Investor</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <PageLoader variant="section" message="Memuat data investor..." />
                ) : investors.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="mx-auto w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                            <HiOutlineUsers className="w-12 h-12 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Belum ada investor</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">Mulai dengan menambahkan investor baru</p>
                    </div>
                ) : (
                    <ResponsiveTable
                        data={investors}
                        columns={columns}
                        keyField="id"
                    />
                )}
            </div>

            <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Tambah Investor Baru" size="lg">
                {renderFormFields()}
                <ModalFooter>
                    <button onClick={() => setShowAddModal(false)} disabled={saving} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        Batal
                    </button>
                    <button onClick={handleAdd} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                        {saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                </ModalFooter>
            </Modal>
        </div>
    )
}

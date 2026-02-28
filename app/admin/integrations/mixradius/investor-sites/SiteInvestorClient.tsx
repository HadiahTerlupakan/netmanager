'use client'

import { useState, useEffect } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiMagnifyingGlass, HiOutlineCurrencyDollar } from 'react-icons/hi2'
import { Modal } from '@/components/ui/Modal'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'

interface InvestorSite {
    id: string
    name: string
    owners: string[]
    isActive: boolean
    createdAt: string
    updatedAt: string
}

export default function SiteInvestorClient() {
    const { hasPermission } = usePermission()

    const canCreate = hasPermission('mixradius_sites:create')
    const canUpdate = hasPermission('mixradius_sites:update')
    const canDelete = hasPermission('mixradius_sites:delete')

    const [sites, setSites] = useState<InvestorSite[]>([])
    const [owners, setOwners] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        owners: [] as string[],
        isActive: true
    })

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            setLoading(true)
            const [sitesRes, ownersRes] = await Promise.all([
                fetch('/api/integrations/mixradius/investor-sites'),
                fetch('/api/integrations/mixradius/owners')
            ])

            if (!sitesRes.ok) {
                throw new Error('Gagal mengambil data Site Investor')
            }
            if (!ownersRes.ok) {
                throw new Error('Gagal mengambil data owner')
            }

            const sitesData = await sitesRes.json()
            const ownersData = await ownersRes.json()

            setSites(Array.isArray(sitesData) ? sitesData : (sitesData.data || []))
            const rawOwners = Array.isArray(ownersData) ? ownersData : (ownersData.data || [])
            setOwners(rawOwners.map((o: unknown) => (typeof o === 'object' && o && 'name' in o ? (o as { name: string }).name : String(o))))
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal mengambil data')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name.trim()) {
            toast.error('Nama Site harus diisi')
            return
        }
        if (formData.owners.length === 0) {
            toast.error('Pilih minimal satu Owner')
            return
        }

        try {
            const url = editingId
                ? `/api/integrations/mixradius/investor-sites/${editingId}`
                : '/api/integrations/mixradius/investor-sites'

            const method = editingId ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Gagal menyimpan data site')
            }

            toast.success(editingId ? 'Site Investor berhasil diperbarui' : 'Site Investor berhasil dibuat')
            setIsModalOpen(false)
            fetchData()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menyimpan data site')
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Hapus Site Investor "${name}"?`)) return

        try {
            const res = await fetch(`/api/integrations/mixradius/investor-sites/${id}`, {
                method: 'DELETE'
            })

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || 'Gagal menghapus site')
            }

            toast.success('Site Investor berhasil dihapus')
            fetchData()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menghapus site')
        }
    }

    const openEdit = (site: InvestorSite) => {
        setEditingId(site.id)
        setFormData({
            name: site.name,
            owners: site.owners,
            isActive: site.isActive
        })
        setIsModalOpen(true)
    }

    const openCreate = () => {
        setEditingId(null)
        setFormData({
            name: '',
            owners: [],
            isActive: true
        })
        setIsModalOpen(true)
    }

    const toggleOwner = (owner: string) => {
        setFormData(prev => {
            const exists = prev.owners.includes(owner)
            if (exists) {
                return { ...prev, owners: prev.owners.filter(o => o !== owner) }
            } else {
                return { ...prev, owners: [...prev.owners, owner] }
            }
        })
    }

    const columns: Column<InvestorSite>[] = [
        {
            header: 'Nama Site Investor',
            key: 'name',
        },
        {
            header: 'Owners MixRadius',
            key: 'owners',
            render: (item: InvestorSite) => (
                <div className="flex flex-wrap gap-1">
                    {item.owners.map((owner: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded-full dark:bg-indigo-900/30 dark:text-indigo-300">
                            {owner}
                        </span>
                    ))}
                </div>
            )
        },
        {
            header: 'Status',
            key: 'isActive',
            render: (item: InvestorSite) => item.isActive
                ? <span className="text-green-600 dark:text-green-400 text-sm font-medium">Aktif</span>
                : <span className="text-red-500 text-sm font-medium">Non-Aktif</span>
        },
        ...((canUpdate || canDelete) ? [{
            header: 'Aksi',
            key: 'id',
            render: (item: InvestorSite) => (
                <div className="flex gap-2">
                    {canUpdate && (
                        <button
                            onClick={() => openEdit(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg dark:text-blue-400 dark:hover:bg-blue-900/30"
                            title="Edit Site Investor"
                        >
                            <HiOutlinePencil className="text-lg" />
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={() => handleDelete(item.id, item.name)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg dark:text-red-400 dark:hover:bg-red-900/30"
                            title="Hapus Site Investor"
                        >
                            <HiOutlineTrash className="text-lg" />
                        </button>
                    )}
                </div>
            )
        }] : [])
    ]

    const filteredSites = sites.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.owners.some(o => o.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <div className="p-6">
            <Toaster />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineCurrencyDollar className="text-indigo-600" />
                        Site Investor MixRadius
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Kelompokkan Owner MixRadius yang penjualannya didanai & masuk perhitungan profit Investor
                    </p>
                </div>

                {canCreate && (
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                        <HiOutlinePlus className="text-xl" />
                        Tambah Site Investor
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-[#1c2936] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="relative max-w-md">
                        <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                        <input
                            type="text"
                            placeholder="Cari Site atau Owner..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <ResponsiveTable
                    data={filteredSites}
                    columns={columns}
                    keyField="id"
                    loading={loading}
                    emptyMessage="Tidak ada Site Investor ditemukan."
                />
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? 'Edit Site Investor' : 'Tambah Site Investor'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-6">

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Nama Site Investor
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Contoh: Proyek Cimenyan - Investor A"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Nama ini akan muncul sebagai salah satu opsi pada &quot;Sumber Biling&quot; di RAB Project.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Pilih Owners MixRadius ({formData.owners.length} dipilih)
                        </label>
                        <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800 h-60 overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {owners.length === 0 ? (
                                    <div className="col-span-2 text-center text-gray-500 py-4">Memuat owners...</div>
                                ) : (
                                    owners.map(owner => (
                                        <label key={owner} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-gray-700/50 rounded cursor-pointer transition">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                checked={formData.owners.includes(owner)}
                                                onChange={() => toggleOwner(owner)}
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{owner}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Pendapatan dari Owner yang dipilih di sini akan dihitung sebagai pendapatan untuk RAB Project yang terkait dengan site ini.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                            checked={formData.isActive}
                            onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                        />
                        <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
                            Set Aktif
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            Simpan
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

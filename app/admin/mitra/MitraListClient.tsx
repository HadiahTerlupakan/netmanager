'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import PageLoader from '@/components/ui/PageLoader'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import {
    HiOutlinePlus,
    HiMagnifyingGlass,
    HiOutlineUsers,
    HiOutlineBanknotes,
    HiOutlineTrash,
    HiOutlineFunnel,
    HiOutlineWrenchScrewdriver,
    HiOutlineMegaphone,
    HiOutlinePencilSquare,
    HiOutlineWallet,
    HiOutlineCheckCircle,
    HiOutlineEye,
} from 'react-icons/hi2'

interface Site {
    id: string
    code: string
    name: string
}

interface Mitra {
    id: string
    name: string | null
    email: string
    phone: string | null
    mitraType: 'MITRA_TEKNISI' | 'MITRA_SALES'
    isActive: boolean
    siteId: string | null
    mitraRateWoPsb: number | null
    mitraRateWoMaintenance: number | null
    mitraRateCanvasing: number | null
    minWithdrawal: number | null
    bankName: string | null
    bankAccountNo: string | null
    bankAccountName: string | null
    garansiHari: number | null
    slaGaransiJam: number | null
    penaltyPsb: number | null
    penaltyMaintenance: number | null
    nik: string | null
    tempatLahir: string | null
    tanggalLahir: string | null
    alamat: string | null
    latitudeRumah: number | null
    longitudeRumah: number | null
    fotoDiri: string | null
    fotoKtp: string | null
    fotoSim: string | null
    fotoKk: string | null
    requiresFaceVerification: boolean
    sites: { name: string } | null
    role: { name: string } | null
    mitraWallet: {
        id: string
        balance: number
        totalEarnings: number
        totalWithdrawn: number
    } | null
    createdAt: string
}

interface MitraTransaction {
    id: string
    amount: number
    type: string
    description: string
    createdAt: string
}

interface Stats {
    totalTeknisi: number
    totalSales: number
    totalActive: number
    totalBalance: number
}

const formatCurrency = (amount: number | null | undefined) => {
    if (amount === undefined || amount === null) return 'Rp 0'
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount)
}

export default function MitraListClient() {
    const { hasPermission } = usePermission()
    const canCreate = hasPermission('users:create')
    const canUpdate = hasPermission('users:update')
    const canDelete = hasPermission('users:delete')

    const [mitras, setMitras] = useState<Mitra[]>([])
    const [sites, setSites] = useState<Site[]>([])
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | 'MITRA_TEKNISI' | 'MITRA_SALES'>('all')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [showWalletModal, setShowWalletModal] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [selectedMitra, setSelectedMitra] = useState<Mitra | null>(null)
    const [saving, setSaving] = useState(false)

    // Form state
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        employeeType: 'MITRA_TEKNISI' as 'MITRA_TEKNISI' | 'MITRA_SALES',
        siteId: '',
        mitraRateWoPsb: '',
        mitraRateWoMaintenance: '',
        mitraRateCanvasing: '',
        minWithdrawal: '',
        bankName: '',
        bankAccountNo: '',
        bankAccountName: '',
        targetHarian: '',
        garansiHari: '',
        slaGaransiJam: '',
        penaltyPsb: '',
        penaltyMaintenance: '',
        nik: '',
        tempatLahir: '',
        tanggalLahir: '',
        alamat: '',
        latitudeRumah: '',
        longitudeRumah: '',
        fotoDiri: '',
        fotoKtp: '',
        fotoSim: '',
        fotoKk: '',
    })

    // Wallet state
    const [walletData, setWalletData] = useState<{
        balance: { balance: number; totalEarnings: number; totalWithdrawn: number } | null
        transactions: { transactions: MitraTransaction[]; total: number } | null
    } | null>(null)
    const [adjustmentForm, setAdjustmentForm] = useState({ amount: '', description: '' })
    const [adjusting, setAdjusting] = useState(false)

    const fetchMitras = useCallback(async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (searchTerm) params.set('search', searchTerm)
            if (typeFilter !== 'all') params.set('type', typeFilter)
            params.set('page', page.toString())
            params.set('limit', '20')

            const res = await fetch(`/api/admin/mitra?${params}`)
            const data = await res.json()

            if (res.ok && data.success) {
                setMitras(data.data.mitras || [])
                setTotalPages(data.data.totalPages || 1)
                setTotal(data.data.total || 0)
                setStats(data.data.stats || null)
            } else {
                toast.error(data.error || 'Gagal memuat data mitra')
            }
        } catch {
            toast.error('Terjadi kesalahan saat memuat data mitra')
        } finally {
            setLoading(false)
        }
    }, [searchTerm, typeFilter, page])

    const fetchSites = useCallback(async () => {
        try {
            const res = await fetch('/api/sites')
            const data = await res.json()
            if (res.ok && data.sites) {
                setSites(data.sites)
            }
        } catch {
            // Silent fail for sites
        }
    }, [])

    useEffect(() => { fetchMitras() }, [fetchMitras])
    useEffect(() => { fetchSites() }, [fetchSites])
    useEffect(() => { setPage(1) }, [searchTerm, typeFilter])

    const resetForm = () => {
        setForm({
            name: '', email: '', password: '', phone: '',
            employeeType: 'MITRA_TEKNISI', siteId: '',
            mitraRateWoPsb: '', mitraRateWoMaintenance: '', mitraRateCanvasing: '',
            minWithdrawal: '',
            bankName: '', bankAccountNo: '', bankAccountName: '',
            targetHarian: '',
            garansiHari: '', slaGaransiJam: '', penaltyPsb: '', penaltyMaintenance: '',
            nik: '', tempatLahir: '', tanggalLahir: '', alamat: '',
            latitudeRumah: '', longitudeRumah: '',
            fotoDiri: '', fotoKtp: '', fotoSim: '', fotoKk: '',
        })
    }

    const handleAdd = async () => {
        if (!form.name || !form.email || !form.password) {
            toast.error('Nama, email, dan password harus diisi')
            return
        }
        setSaving(true)
        try {
            const res = await fetch('/api/admin/mitra', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    siteId: form.siteId || undefined,
                    mitraRateWoPsb: form.mitraRateWoPsb ? parseFloat(form.mitraRateWoPsb) : undefined,
                    mitraRateWoMaintenance: form.mitraRateWoMaintenance ? parseFloat(form.mitraRateWoMaintenance) : undefined,
                    mitraRateCanvasing: form.mitraRateCanvasing ? parseFloat(form.mitraRateCanvasing) : undefined,
                    minWithdrawal: form.minWithdrawal ? parseFloat(form.minWithdrawal) : undefined,
                    targetHarian: form.targetHarian ? parseInt(form.targetHarian, 10) : undefined,
                    garansiHari: form.garansiHari ? parseInt(form.garansiHari, 10) : undefined,
                    slaGaransiJam: form.slaGaransiJam ? parseInt(form.slaGaransiJam, 10) : undefined,
                    penaltyPsb: form.penaltyPsb ? parseFloat(form.penaltyPsb) : undefined,
                    penaltyMaintenance: form.penaltyMaintenance ? parseFloat(form.penaltyMaintenance) : undefined,
                    nik: form.nik || undefined,
                    tempatLahir: form.tempatLahir || undefined,
                    tanggalLahir: form.tanggalLahir || undefined,
                    alamat: form.alamat || undefined,
                    latitudeRumah: form.latitudeRumah ? parseFloat(form.latitudeRumah) : undefined,
                    longitudeRumah: form.longitudeRumah ? parseFloat(form.longitudeRumah) : undefined,
                    fotoDiri: form.fotoDiri || undefined,
                    fotoKtp: form.fotoKtp || undefined,
                    fotoSim: form.fotoSim || undefined,
                    fotoKk: form.fotoKk || undefined,
                }),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                toast.success('Mitra berhasil ditambahkan')
                setShowAddModal(false)
                resetForm()
                fetchMitras()
            } else {
                toast.error(data.error || 'Gagal menambahkan mitra')
            }
        } catch {
            toast.error('Terjadi kesalahan')
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = async () => {
        if (!selectedMitra) return
        setSaving(true)
        try {
            const res = await fetch(`/api/admin/mitra/${selectedMitra.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name,
                    email: form.email,
                    password: form.password || undefined,
                    phone: form.phone || undefined,
                    employeeType: form.employeeType,
                    siteId: form.siteId || null,
                    mitraRateWoPsb: form.mitraRateWoPsb ? parseFloat(form.mitraRateWoPsb) : undefined,
                    mitraRateWoMaintenance: form.mitraRateWoMaintenance ? parseFloat(form.mitraRateWoMaintenance) : undefined,
                    mitraRateCanvasing: form.mitraRateCanvasing ? parseFloat(form.mitraRateCanvasing) : undefined,
                    minWithdrawal: form.minWithdrawal ? parseFloat(form.minWithdrawal) : undefined,
                    bankName: form.bankName || undefined,
                    bankAccountNo: form.bankAccountNo || undefined,
                    bankAccountName: form.bankAccountName || undefined,
                    targetHarian: form.targetHarian ? parseInt(form.targetHarian, 10) : undefined,
                    garansiHari: form.garansiHari ? parseInt(form.garansiHari, 10) : undefined,
                    slaGaransiJam: form.slaGaransiJam ? parseInt(form.slaGaransiJam, 10) : undefined,
                    penaltyPsb: form.penaltyPsb ? parseFloat(form.penaltyPsb) : undefined,
                    penaltyMaintenance: form.penaltyMaintenance ? parseFloat(form.penaltyMaintenance) : undefined,
                    nik: form.nik || undefined,
                    tempatLahir: form.tempatLahir || undefined,
                    tanggalLahir: form.tanggalLahir || undefined,
                    alamat: form.alamat || undefined,
                    latitudeRumah: form.latitudeRumah ? parseFloat(form.latitudeRumah) : undefined,
                    longitudeRumah: form.longitudeRumah ? parseFloat(form.longitudeRumah) : undefined,
                    fotoDiri: form.fotoDiri || undefined,
                    fotoKtp: form.fotoKtp || undefined,
                    fotoSim: form.fotoSim || undefined,
                    fotoKk: form.fotoKk || undefined,
                }),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                toast.success('Mitra berhasil diperbarui')
                setShowEditModal(false)
                fetchMitras()
            } else {
                toast.error(data.error || 'Gagal memperbarui mitra')
            }
        } catch {
            toast.error('Terjadi kesalahan')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteId) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/mitra/${deleteId}`, { method: 'DELETE' })
            const data = await res.json()
            if (res.ok && data.success) {
                toast.success('Mitra berhasil dinonaktifkan')
                setDeleteId(null)
                fetchMitras()
            } else {
                toast.error(data.error || 'Gagal menonaktifkan mitra')
            }
        } catch {
            toast.error('Terjadi kesalahan')
        } finally {
            setDeleting(false)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Ukuran file maksimal 5MB')
            return
        }

        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'mitra-document')

        const toastId = toast.loading(`Mengunggah gambar...`)
        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setForm(f => ({ ...f, [field]: data.url }))
                toast.success('Gambar berhasil diunggah', { id: toastId })
            } else {
                toast.error(data.error || 'Gagal mengunggah', { id: toastId })
            }
        } catch {
            toast.error('Terjadi kesalahan jaringan', { id: toastId })
        }
    }

    const openEditModal = (mitra: Mitra) => {
        setSelectedMitra(mitra)
        setForm({
            name: mitra.name || '',
            email: mitra.email,
            password: '',
            phone: mitra.phone || '',
            employeeType: mitra.mitraType,
            siteId: mitra.siteId || '',
            mitraRateWoPsb: mitra.mitraRateWoPsb?.toString() || '',
            mitraRateWoMaintenance: mitra.mitraRateWoMaintenance?.toString() || '',
            mitraRateCanvasing: mitra.mitraRateCanvasing?.toString() || '',
            minWithdrawal: mitra.minWithdrawal?.toString() || '',
            bankName: mitra.bankName || '',
            bankAccountNo: mitra.bankAccountNo || '',
            bankAccountName: mitra.bankAccountName || '',
            targetHarian: (mitra as Mitra & { targetHarian?: number }).targetHarian?.toString() || '',
            garansiHari: mitra.garansiHari?.toString() || '',
            slaGaransiJam: mitra.slaGaransiJam?.toString() || '',
            penaltyPsb: mitra.penaltyPsb?.toString() || '',
            penaltyMaintenance: mitra.penaltyMaintenance?.toString() || '',
            nik: mitra.nik || '',
            tempatLahir: mitra.tempatLahir || '',
            tanggalLahir: mitra.tanggalLahir ? new Date(mitra.tanggalLahir).toISOString().split('T')[0] : '',
            alamat: mitra.alamat || '',
            latitudeRumah: mitra.latitudeRumah?.toString() || '',
            longitudeRumah: mitra.longitudeRumah?.toString() || '',
            fotoDiri: mitra.fotoDiri || '',
            fotoKtp: mitra.fotoKtp || '',
            fotoSim: mitra.fotoSim || '',
            fotoKk: mitra.fotoKk || '',
        })
        setShowEditModal(true)
    }

    const openWalletModal = async (mitra: Mitra) => {
        setSelectedMitra(mitra)
        setWalletData(null)
        setShowWalletModal(true)

        try {
            const res = await fetch(`/api/admin/mitra/${mitra.id}/wallet`)
            const data = await res.json()
            if (res.ok && data.success) {
                setWalletData(data.data)
            } else {
                toast.error('Gagal memuat data wallet')
            }
        } catch {
            toast.error('Terjadi kesalahan')
        }
    }

    const handleAdjustment = async () => {
        if (!selectedMitra || !adjustmentForm.amount || !adjustmentForm.description) {
            toast.error('Jumlah dan deskripsi harus diisi')
            return
        }
        setAdjusting(true)
        try {
            const res = await fetch(`/api/admin/mitra/${selectedMitra.id}/wallet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: parseFloat(adjustmentForm.amount),
                    description: adjustmentForm.description,
                }),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                toast.success('Penyesuaian saldo berhasil')
                setAdjustmentForm({ amount: '', description: '' })
                // Refresh wallet data
                openWalletModal(selectedMitra)
                fetchMitras()
            } else {
                toast.error(data.error || 'Gagal melakukan penyesuaian')
            }
        } catch {
            toast.error('Terjadi kesalahan')
        } finally {
            setAdjusting(false)
        }
    }

    const columns: Column<Mitra>[] = [
        {
            key: 'name',
            header: 'Mitra',
            priority: 'primary',
            render: (mitra) => (
                <div className="flex items-center gap-3">
                    <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${mitra.mitraType === 'MITRA_TEKNISI'
                        ? 'bg-linear-to-br from-blue-500 to-cyan-600'
                        : 'bg-linear-to-br from-purple-500 to-pink-600'
                        }`}>
                        {mitra.mitraType === 'MITRA_TEKNISI'
                            ? <HiOutlineWrenchScrewdriver className="w-5 h-5 text-white" />
                            : <HiOutlineMegaphone className="w-5 h-5 text-white" />
                        }
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {mitra.name || mitra.email.split('@')[0]}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            {mitra.email}
                            {mitra.requiresFaceVerification && (
                                <span className="ml-2 inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-xs font-medium dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Wajib Verif Wajah
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: 'employeeType',
            header: 'Tipe',
            priority: 'primary',
            render: (mitra) => (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${mitra.mitraType === 'MITRA_TEKNISI'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>
                    {mitra.mitraType === 'MITRA_TEKNISI' ? 'Teknisi' : 'Sales'}
                </span>
            )
        },
        {
            key: 'phone',
            header: 'Telepon',
            priority: 'secondary',
            render: (mitra) => (
                <span className="text-sm text-gray-600 dark:text-gray-400">{mitra.phone || '-'}</span>
            )
        },
        {
            key: 'rate',
            header: 'Rate Komisi',
            priority: 'secondary',
            render: (mitra) => (
                <div className="text-sm">
                    {mitra.mitraType === 'MITRA_TEKNISI' ? (
                        <div className="flex flex-col gap-1 text-sm bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-medium">PSB:</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    {formatCurrency(mitra.mitraRateWoPsb)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-medium whitespace-nowrap">MTc:</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    {formatCurrency(mitra.mitraRateWoMaintenance)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-purple-600 dark:text-purple-400 font-medium">
                            Canvasing: {formatCurrency(mitra.mitraRateCanvasing)}
                        </span>
                    )}
                </div>
            )
        },
        {
            key: 'wallet',
            header: 'Saldo',
            priority: 'primary',
            render: (mitra) => (
                <div className="text-sm font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(mitra.mitraWallet?.balance || 0)}
                </div>
            )
        },
        {
            key: 'isActive',
            header: 'Status',
            priority: 'primary',
            render: (mitra) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${mitra.isActive
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                    {mitra.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
            )
        },
    ]

    const handleRequestFaceVerification = async (mitraId: string) => {
        if (!confirm('Apakah Anda yakin ingin mewajibkan mitra ini untuk melakukan Verifikasi Wajah (Liveness) pada login berikutnya?')) return
        const toastId = toast.loading('Memicu verifikasi wajah...')
        try {
            const res = await fetch(`/api/admin/mitra/${mitraId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requiresFaceVerification: true })
            })
            const data = await res.json()
            if (res.ok && data.success) {
                toast.success('Mitra diwajibkan verifikasi wajah', { id: toastId })
                fetchMitras()
            } else {
                toast.error(data.error || 'Gagal mengubah status', { id: toastId })
            }
        } catch {
            toast.error('Terjadi kesalahan jaringan', { id: toastId })
        }
    }

    const renderActions = (mitra: Mitra) => (
        <>
            <button
                onClick={() => window.location.href = `/admin/mitra/${mitra.id}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Lihat Detail"
            >
                <HiOutlineEye className="w-4 h-4" />
            </button>
            <button
                onClick={() => handleRequestFaceVerification(mitra.id)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors ${mitra.requiresFaceVerification ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400'}`}
                title={mitra.requiresFaceVerification ? "Sedang menunggu verifikasi wajah" : "Minta Verifikasi Wajah"}
                disabled={mitra.requiresFaceVerification}
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>
            <button
                onClick={() => window.open(`/mitra-id/${mitra.id}`, '_blank')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                title="Lihat/Print ID Card Resmi"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
            </button>
            <button
                onClick={() => openWalletModal(mitra)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                title="Lihat Wallet"
            >
                <HiOutlineWallet className="w-4 h-4" />
            </button>
            {canUpdate && (
                <button
                    onClick={() => openEditModal(mitra)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    title="Edit"
                >
                    <HiOutlinePencilSquare className="w-4 h-4" />
                </button>
            )}
            {canDelete && (
                <button
                    onClick={() => setDeleteId(mitra.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                    title="Nonaktifkan"
                >
                    <HiOutlineTrash className="w-4 h-4" />
                </button>
            )}
        </>
    )

    const renderFormFields = (isEdit: boolean = false) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama *</label>
                <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Nama mitra"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="email@contoh.com"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder={isEdit ? "Kosongkan jika tidak ingin diubah" : "••••••••"}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telepon</label>
                <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="08xxxxxxxxxx"
                />
            </div>

            <div className="md:col-span-2">
                <div className="border-t border-gray-200 dark:border-gray-700 my-2 pt-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Informasi Data Diri (KYC)</h4>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NIK</label>
                <input
                    type="text"
                    value={form.nik}
                    onChange={(e) => setForm(f => ({ ...f, nik: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Nomor Induk Kependudukan"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tempat Lahir</label>
                <input
                    type="text"
                    value={form.tempatLahir}
                    onChange={(e) => setForm(f => ({ ...f, tempatLahir: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Contoh: Jakarta"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Lahir</label>
                <input
                    type="date"
                    value={form.tanggalLahir}
                    onChange={(e) => setForm(f => ({ ...f, tanggalLahir: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
            </div>
            <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alamat Domisili</label>
                <textarea
                    value={form.alamat}
                    onChange={(e) => setForm(f => ({ ...f, alamat: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Alamat domisili"
                    rows={1}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Latitude Rumah</label>
                <input
                    type="number"
                    step="any"
                    value={form.latitudeRumah}
                    onChange={(e) => setForm(f => ({ ...f, latitudeRumah: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="-6.123456"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Longitude Rumah</label>
                <input
                    type="number"
                    step="any"
                    value={form.longitudeRumah}
                    onChange={(e) => setForm(f => ({ ...f, longitudeRumah: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="106.123456"
                />
            </div>

            <div className="md:col-span-2">
                <div className="border-t border-gray-200 dark:border-gray-700 my-2 pt-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Dokumen Pendukung (Maksimal 5MB/file)</h4>
                </div>
            </div>
            {[
                { field: 'fotoDiri', label: 'Foto Diri / Pasfoto' },
                { field: 'fotoKtp', label: 'Foto KTP' },
                { field: 'fotoSim', label: 'Foto SIM' },
                { field: 'fotoKk', label: 'Foto Kartu Keluarga' }
            ].map(({ field, label }) => (
                <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                    <div className="flex items-center gap-3">
                        {form[field as keyof typeof form] && (
                            <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={String(form[field as keyof typeof form])} alt={label} className="h-10 w-10 object-cover rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800" />
                            </>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, field)}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400"
                        />
                    </div>
                </div>
            ))}

            <div className="md:col-span-2">
                <div className="border-t border-gray-200 dark:border-gray-700 my-2 pt-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Informasi Pekerjaan</h4>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipe Mitra *</label>
                <select
                    value={form.employeeType}
                    onChange={(e) => setForm(f => ({ ...f, employeeType: e.target.value as 'MITRA_TEKNISI' | 'MITRA_SALES' }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                    <option value="MITRA_TEKNISI">Mitra Teknisi</option>
                    <option value="MITRA_SALES">Mitra Sales</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site / Lokasi</label>
                <select
                    value={form.siteId}
                    onChange={(e) => setForm(f => ({ ...f, siteId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                    <option value="">— Pilih Site —</option>
                    {sites.map(site => (
                        <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                </select>
            </div>
            {form.employeeType === 'MITRA_TEKNISI' && (
                <>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rate WO PSB</label>
                        <input
                            type="number"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            value={form.mitraRateWoPsb}
                            onChange={(e) => setForm(f => ({ ...f, mitraRateWoPsb: e.target.value }))}
                            placeholder="Cth: 50000"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rate WO Maintenance</label>
                        <input
                            type="number"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            value={form.mitraRateWoMaintenance}
                            onChange={(e) => setForm(f => ({ ...f, mitraRateWoMaintenance: e.target.value }))}
                            placeholder="Cth: 20000"
                        />
                    </div>
                </>
            )}
            {form.employeeType === 'MITRA_SALES' && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rate Canvasing (Rp)</label>
                    <input
                        type="number"
                        value={form.mitraRateCanvasing}
                        onChange={(e) => setForm(f => ({ ...f, mitraRateCanvasing: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="25000"
                    />
                </div>
            )}

            <div className="md:col-span-2">
                <div className="border-t border-gray-200 dark:border-gray-700 my-2 pt-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Informasi Bank (Opsional)</h4>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Bank</label>
                <input
                    type="text"
                    value={form.bankName}
                    onChange={(e) => setForm(f => ({ ...f, bankName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="BCA, BNI, Mandiri..."
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No. Rekening</label>
                <input
                    type="text"
                    value={form.bankAccountNo}
                    onChange={(e) => setForm(f => ({ ...f, bankAccountNo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="1234567890"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Pemilik Rekening</label>
                <input
                    type="text"
                    value={form.bankAccountName}
                    onChange={(e) => setForm(f => ({ ...f, bankAccountName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="A.N John Doe"
                />
            </div>

            <div className="md:col-span-2">
                <div className="border-t border-gray-200 dark:border-gray-700 my-2 pt-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Ketentuan Penarikan (Opsional)</h4>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Minimal Penarikan (Rp)</label>
                <input
                    type="number"
                    value={form.minWithdrawal}
                    onChange={(e) => setForm(f => ({ ...f, minWithdrawal: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Cth: 50000"
                />
                <p className="mt-1 text-xs text-gray-500">Kosongkan untuk mengikuti default sistem</p>
            </div>

            {form.employeeType === 'MITRA_SALES' && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Harian</label>
                    <input
                        type="number"
                        min="0"
                        value={form.targetHarian}
                        onChange={(e) => setForm(f => ({ ...f, targetHarian: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Contoh: 5"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Target jumlah closing yang harus dicapai setiap hari.
                    </p>
                </div>
            )}

            <div className="md:col-span-2">
                <div className="border-t border-gray-200 dark:border-gray-700 my-2 pt-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Pengaturan Garansi Mitra</h4>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Masa Garansi (Hari)</label>
                <input
                    type="number"
                    min="0"
                    value={form.garansiHari}
                    onChange={(e) => setForm(f => ({ ...f, garansiHari: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Contoh: 7"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SLA Tunggu Lelang (Jam)</label>
                <input
                    type="number"
                    min="0"
                    value={form.slaGaransiJam}
                    onChange={(e) => setForm(f => ({ ...f, slaGaransiJam: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Contoh: 24"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Denda Garansi PSB (Rp)</label>
                <input
                    type="number"
                    min="0"
                    value={form.penaltyPsb}
                    onChange={(e) => setForm(f => ({ ...f, penaltyPsb: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Contoh: 50000"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Denda Garansi MTC (Rp)</label>
                <input
                    type="number"
                    min="0"
                    value={form.penaltyMaintenance}
                    onChange={(e) => setForm(f => ({ ...f, penaltyMaintenance: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Contoh: 30000"
                />
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Mitra</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Kelola mitra teknisi dan mitra sales</p>
                </div>
                {canCreate && (
                    <button
                        onClick={() => { resetForm(); setShowAddModal(true) }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors shadow-sm"
                    >
                        <HiOutlinePlus className="w-5 h-5 text-white" />
                        <span className="text-white">Tambah Mitra</span>
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-linear-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 rounded-lg">
                            <HiOutlineWrenchScrewdriver className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalTeknisi || 0}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Mitra Teknisi</p>
                        </div>
                    </div>
                </div>
                <div className="bg-linear-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-500/10 rounded-lg">
                            <HiOutlineMegaphone className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalSales || 0}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Mitra Sales</p>
                        </div>
                    </div>
                </div>
                <div className="bg-linear-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-500/10 rounded-lg">
                            <HiOutlineCheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalActive || 0}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Mitra Aktif</p>
                        </div>
                    </div>
                </div>
                <div className="bg-linear-to-r from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-500/10 rounded-lg">
                            <HiOutlineBanknotes className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats?.totalBalance || 0)}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Saldo</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <HiMagnifyingGlass className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Cari mitra berdasarkan nama, email, atau telepon..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <HiOutlineFunnel className="h-5 w-5 text-gray-400" />
                        </div>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as 'all' | 'MITRA_TEKNISI' | 'MITRA_SALES')}
                            className="pl-10 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option value="all">Semua Tipe</option>
                            <option value="MITRA_TEKNISI">Mitra Teknisi</option>
                            <option value="MITRA_SALES">Mitra Sales</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Mitra Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <PageLoader variant="section" message="Memuat data mitra..." />
                ) : mitras.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="mx-auto w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                            <HiOutlineUsers className="w-12 h-12 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Belum ada mitra</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">
                            {searchTerm || typeFilter !== 'all' ? 'Coba ubah filter pencarian' : 'Mulai dengan menambahkan mitra baru'}
                        </p>
                    </div>
                ) : (
                    <>
                        <ResponsiveTable
                            data={mitras}
                            columns={columns}
                            keyField="id"
                            renderActions={renderActions}
                        />
                        {totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Menampilkan {((page - 1) * 20) + 1} - {Math.min(page * 20, total)} dari {total} mitra
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Sebelumnya
                                    </button>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        Hal {page} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Selanjutnya
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Add Modal */}
            <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Tambah Mitra Baru" size="lg">
                {renderFormFields(false)}
                <ModalFooter>
                    <button onClick={() => setShowAddModal(false)} disabled={saving} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        Batal
                    </button>
                    <button onClick={handleAdd} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                        {saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                </ModalFooter>
            </Modal>

            {/* Edit Modal */}
            <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Mitra" size="lg">
                {renderFormFields(true)}
                <ModalFooter>
                    <button onClick={() => setShowEditModal(false)} disabled={saving} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        Batal
                    </button>
                    <button onClick={handleEdit} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                        {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                </ModalFooter>
            </Modal>

            {/* Wallet Modal */}
            <Modal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} title={`Wallet — ${selectedMitra?.name || ''}`} size="lg">
                {!walletData ? (
                    <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Balance Summary */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Saldo</p>
                                <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">
                                    {formatCurrency(walletData.balance?.balance || 0)}
                                </p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Earning</p>
                                <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                                    {formatCurrency(walletData.balance?.totalEarnings || 0)}
                                </p>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total WD</p>
                                <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
                                    {formatCurrency(walletData.balance?.totalWithdrawn || 0)}
                                </p>
                            </div>
                        </div>

                        {/* Recent Transactions */}
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Transaksi Terakhir</h4>
                            {walletData.transactions?.transactions && walletData.transactions.transactions.length > 0 ? (
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-48 overflow-y-auto">
                                    {walletData.transactions.transactions.map((tx: MitraTransaction) => (
                                        <div key={tx.id} className="px-4 py-3 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-gray-900 dark:text-white">{tx.description}</p>
                                                <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                            <span className={`text-sm font-medium ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">Belum ada transaksi</p>
                            )}
                        </div>

                        {/* Admin Adjustment */}
                        {canUpdate && (
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Penyesuaian Saldo (Admin)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <input
                                        type="number"
                                        placeholder="Jumlah (positif/negatif)"
                                        value={adjustmentForm.amount}
                                        onChange={(e) => setAdjustmentForm(f => ({ ...f, amount: e.target.value }))}
                                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Deskripsi"
                                        value={adjustmentForm.description}
                                        onChange={(e) => setAdjustmentForm(f => ({ ...f, description: e.target.value }))}
                                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                    />
                                </div>
                                <button
                                    onClick={handleAdjustment}
                                    disabled={adjusting}
                                    className="mt-2 px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                                >
                                    {adjusting ? 'Memproses...' : 'Terapkan Penyesuaian'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Delete Confirmation */}
            <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Nonaktifkan Mitra?" size="md">
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <HiOutlineTrash className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Mitra ini akan dinonaktifkan dan tidak bisa login. Data tidak dihapus permanen.
                    </p>
                </div>
                <ModalFooter>
                    <button onClick={() => setDeleteId(null)} disabled={deleting} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        Batal
                    </button>
                    <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                        {deleting ? 'Memproses...' : 'Ya, Nonaktifkan'}
                    </button>
                </ModalFooter>
            </Modal>

        </div>
    )
}

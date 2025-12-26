'use client'

import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { MdCheckCircle, MdCancel, MdPending, MdAdd, MdDelete } from 'react-icons/md'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface LeaveRequest {
    id: string
    type: string
    startDate: string
    endDate: string
    reason: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    attachmentUrl?: string
    attachments?: string[]
    rejectionReason?: string
    createdAt: string
    user: {
        id: string
        name: string | null
        image: string | null
        department: { name: string } | null
        site: { name: string } | null
    }
}

interface User {
    id: string
    name: string
    email: string
}

export default function AdminLeavePage() {
    const [leaves, setLeaves] = useState<LeaveRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState<string>('PENDING')

    // Action Modal State
    const [isActionModalOpen, setIsActionModalOpen] = useState(false)
    const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
    const [rejectionReason, setRejectionReason] = useState('')
    const [actionLoading, setActionLoading] = useState(false)
    const [currentSlide, setCurrentSlide] = useState(0)

    useEffect(() => {
        if (selectedRequest) {
            setCurrentSlide(0)
            setRejectionReason('')
        }
    }, [selectedRequest])

    const getImages = (req: LeaveRequest) => {
        const urls: string[] = []
        if (req.attachments && req.attachments.length > 0) {
            urls.push(...req.attachments)
        } else if (req.attachmentUrl) {
            urls.push(req.attachmentUrl)
        }
        // Filter out undefined, null, empty strings, and local file paths
        return urls.filter(url => 
            url && 
            typeof url === 'string' && 
            url.trim() !== '' && 
            !url.includes('undefined') &&
            (url.startsWith('http') || url.startsWith('/'))
        )
    }

    const images = selectedRequest ? getImages(selectedRequest) : []

    // Manual Input Modal State
    const [isManualModalOpen, setIsManualModalOpen] = useState(false)
    const [users, setUsers] = useState<User[]>([])
    const [manualForm, setManualForm] = useState({
        userId: '',
        type: 'SAKIT',
        startDate: '',
        endDate: '',
        reason: '',
        attachmentUrl: '',
        attachments: [] as string[] // Added attachments field
    })
    const [uploading, setUploading] = useState(false)

    // Searchable Dropdown State
    const [searchTerm, setSearchTerm] = useState('')
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)

    // Filtered users for search
    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            toast.error('Hanya boleh upload gambar')
            return
        }

        setUploading(true)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'employee-attendance')

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })

            if (res.ok) {
                const data = await res.json()
                setManualForm(prev => ({ ...prev, attachmentUrl: data.url }))
                toast.success('Gambar berhasil diupload')
            } else {
                const err = await res.json()
                toast.error(err.error || 'Gagal upload gambar')
            }
        } catch (error) {
            console.error(error)
            toast.error('Terjadi kesalahan saat upload')
        } finally {
            setUploading(false)
        }
    }

    useEffect(() => {
        fetchLeaves()
    }, [filterStatus])

    const fetchLeaves = async () => {
        setLoading(true)
        try {
            const query = filterStatus === 'ALL' ? '' : `?status=${filterStatus}`
            const res = await fetch(`/api/admin/leaves${query}`)
            if (res.ok) {
                const data = await res.json()
                setLeaves(data)
            }
        } catch (error) { console.error(error) }
        finally { setLoading(false) }
    }

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users?limit=1000') // Fetch all users roughly
            if (res.ok) {
                const data = await res.json()
                // Depending on the API response structure, adjust here. 
                // Using 'users' property if paginated, or direct array.
                // Assuming direct array or { users: [] }
                setUsers(Array.isArray(data) ? data : data.users || [])
            }
        } catch (error) { console.error('Failed to fetch users', error) }
    }

    const handleOpenManualModal = () => {
        if (users.length === 0) fetchUsers()
        setIsManualModalOpen(true)
    }

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!manualForm.userId || !manualForm.startDate || !manualForm.endDate || !manualForm.reason) {
            toast.error('Mohon lengkapi semua field')
            return
        }

        setActionLoading(true)
        try {
            const res = await fetch('/api/admin/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(manualForm)
            })

            if (res.ok) {
                toast.success('Pengajuan manual berhasil dibuat')
                setIsManualModalOpen(false)
                setManualForm({ userId: '', type: 'SAKIT', startDate: '', endDate: '', reason: '', attachmentUrl: '', attachments: [] })
                setSearchTerm('')
                fetchLeaves()
            } else {
                toast.error('Gagal membuat pengajuan')
            }
        } catch (error) {
            toast.error('Terjadi kesalahan')
        } finally {
            setActionLoading(false)
        }
    }

    const handleAction = async (status: 'APPROVED' | 'REJECTED') => {
        if (!selectedRequest) return
        if (status === 'REJECTED' && !rejectionReason.trim()) {
            toast.error('Harap isi alasan penolakan')
            return
        }

        setActionLoading(true)
        try {
            const res = await fetch(`/api/admin/leaves/${selectedRequest.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, rejectionReason })
            })

            if (res.ok) {
                toast.success(status === 'APPROVED' ? 'Pengajuan disetujui' : 'Pengajuan ditolak')
                setIsActionModalOpen(false)
                fetchLeaves()
            } else {
                toast.error('Gagal memproses pengajuan')
            }
        } catch (error) {
            console.error(error)
            toast.error('Terjadi kesalahan')
        } finally {
            setActionLoading(false)
        }
    }

    const handleDelete = async (id?: string) => {
        const targetId = id || selectedRequest?.id
        if (!targetId) return

        if (!confirm('Apakah Anda yakin ingin menghapus pengajuan ini secara permanen?')) return

        setActionLoading(true)
        try {
            const res = await fetch(`/api/admin/leaves/${targetId}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                toast.success('Pengajuan berhasil dihapus')
                setIsActionModalOpen(false)
                fetchLeaves()
            } else {
                const err = await res.json()
                toast.error(err.error || 'Gagal menghapus')
            }
        } catch (error) {
            console.error(error)
            toast.error('Terjadi kesalahan')
        } finally {
            setActionLoading(false)
        }
    }

    const openActionModal = (req: LeaveRequest) => {
        setSelectedRequest(req)
        setRejectionReason('')
        setIsActionModalOpen(true)
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 flex items-center gap-1"><MdCheckCircle /> Disetujui</span>
            case 'REJECTED': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1"><MdCancel /> Ditolak</span>
            default: return <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 flex items-center gap-1"><MdPending /> Menunggu</span>
        }
    }

    return (
        <div className="p-6">
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Manajemen Izin & Cuti</h1>
                    <p className="text-gray-500 text-sm">Kelola pengajuan izin, sakit, dan cuti karyawan</p>
                </div>
                <button
                    onClick={handleOpenManualModal}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm flex items-center gap-2"
                >
                    <MdAdd className="size-5" /> Input Manual
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex gap-2 overflow-x-auto">
                {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${filterStatus === status
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                    >
                        {status === 'ALL' ? 'Semua' : status === 'PENDING' ? 'Menunggu Konfirmasi' : status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                            <tr>
                                <th className="px-6 py-3">Karyawan</th>
                                <th className="px-6 py-3">Tipe</th>
                                <th className="px-6 py-3">Tanggal</th>
                                <th className="px-6 py-3">Alasan</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Memuat data...</td>
                                </tr>
                            ) : leaves.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Tidak ada pengajuan ditemukan.</td>
                                </tr>
                            ) : (
                                leaves.map((req) => (
                                    <tr key={req.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="size-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                                    {req.user.name?.charAt(0) || 'U'}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white">{req.user.name}</div>
                                                    <div className="text-xs text-gray-500">{req.user.department?.name} - {req.user.site?.name}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium">{req.type}</td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {format(new Date(req.startDate), 'dd MMM yyyy', { locale: id })} - {format(new Date(req.endDate), 'dd MMM yyyy', { locale: id })}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 truncate max-w-xs" title={req.reason}>{req.reason}</td>
                                        <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openActionModal(req)}
                                                    className="text-blue-600 hover:text-blue-800 font-bold text-xs"
                                                >
                                                    Detail
                                                </button>
                                                <span className="text-gray-300">|</span>
                                                <button
                                                    onClick={() => handleDelete(req.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                    title="Hapus Pengajuan"
                                                >
                                                    <MdDelete className="text-lg" />
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

            {/* Manual Input Modal */}
            {isManualModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Input Manual Izin/Cuti</h3>
                        <form onSubmit={handleManualSubmit} className="space-y-4">
                            <div className="relative">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Karyawan</label>
                                <div
                                    className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm cursor-pointer flex justify-between items-center"
                                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                                >
                                    <span className={manualForm.userId ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
                                        {manualForm.userId
                                            ? users.find(u => u.id === manualForm.userId)?.name || 'Karyawan Terpilih'
                                            : 'Pilih Karyawan'
                                        }
                                    </span>
                                    <span className="text-gray-500">▼</span>
                                </div>

                                {isUserDropdownOpen && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto overflow-hidden">
                                        <div className="p-2 sticky top-0 bg-white dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
                                            <input
                                                type="text"
                                                autoFocus
                                                placeholder="Cari nama karyawan..."
                                                className="w-full p-2 rounded-md border border-gray-200 dark:border-gray-500 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        {filteredUsers.length === 0 ? (
                                            <div className="p-3 text-center text-gray-500 text-sm">Tidak ditemukan</div>
                                        ) : (
                                            filteredUsers.map(u => (
                                                <div
                                                    key={u.id}
                                                    onClick={() => {
                                                        setManualForm({ ...manualForm, userId: u.id })
                                                        setIsUserDropdownOpen(false)
                                                        setSearchTerm('')
                                                    }}
                                                    className={`p-2.5 text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors border-b border-gray-50 dark:border-gray-600 last:border-0 ${manualForm.userId === u.id ? 'bg-blue-50 text-blue-600 dark:bg-gray-600' : 'text-gray-900 dark:text-white'}`}
                                                >
                                                    {u.name}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Tipe</label>
                                <select
                                    value={manualForm.type}
                                    onChange={(e) => setManualForm({ ...manualForm, type: e.target.value })}
                                    className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="SAKIT">Sakit</option>
                                    <option value="CUTI">Cuti</option>
                                    <option value="IZIN">Izin</option>
                                    <option value="LAINNYA">Lainnya</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Mulai</label>
                                    <input
                                        type="date"
                                        required
                                        value={manualForm.startDate}
                                        onChange={(e) => setManualForm({ ...manualForm, startDate: e.target.value })}
                                        className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Sampai</label>
                                    <input
                                        type="date"
                                        required
                                        value={manualForm.endDate}
                                        onChange={(e) => setManualForm({ ...manualForm, endDate: e.target.value })}
                                        className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Alasan / Keterangan</label>
                                <textarea
                                    required
                                    value={manualForm.reason}
                                    onChange={(e) => setManualForm({ ...manualForm, reason: e.target.value })}
                                    className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    placeholder="Contoh: Sakit demam, surat menyusul..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Lampiran (Opsional)</label>
                                <div className="flex flex-col gap-2">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        disabled={uploading}
                                        className="block w-full text-sm text-gray-500
                                            file:mr-4 file:py-2 file:px-4
                                            file:rounded-full file:border-0
                                            file:text-xs file:font-semibold
                                            file:bg-blue-50 file:text-blue-700
                                            hover:file:bg-blue-100
                                            dark:file:bg-gray-700 dark:file:text-gray-300
                                        "
                                    />
                                    {uploading && <span className="text-xs text-blue-600 animate-pulse">Mengupload gambar...</span>}
                                    {manualForm.attachmentUrl && (
                                        <div className="text-xs text-green-600 flex items-center gap-1">
                                            <MdCheckCircle /> File berhasil diupload
                                            <a href={manualForm.attachmentUrl} target="_blank" rel="noreferrer" className="underline ml-1">Lihat</a>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsManualModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-gray-600 bg-gray-100 hover:bg-gray-200 font-bold text-sm"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 font-bold text-sm disabled:opacity-50"
                                >
                                    {actionLoading ? 'Menyimpan...' : 'Simpan & Setujui'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Action Modal */}
            {isActionModalOpen && selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Detail Pengajuan</h3>

                        <div className="space-y-4 mb-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Nama</label>
                                    <p className="font-medium text-gray-900 dark:text-white">{selectedRequest.user.name}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Tipe</label>
                                    <p className="font-medium text-gray-900 dark:text-white">{selectedRequest.type}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Tanggal Mulai</label>
                                    <p className="font-medium text-gray-900 dark:text-white">{format(new Date(selectedRequest.startDate), 'dd MMM yyyy', { locale: id })}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Tanggal Selesai</label>
                                    <p className="font-medium text-gray-900 dark:text-white">{format(new Date(selectedRequest.endDate), 'dd MMM yyyy', { locale: id })}</p>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Alasan</label>
                                <p className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300">{selectedRequest.reason}</p>
                            </div>

                            {images.length > 0 && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">
                                        Lampiran ({currentSlide + 1} / {images.length})
                                    </label>
                                    <div className="relative w-full h-56 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 group">
                                        <img
                                            src={images[currentSlide]}
                                            alt={`Lampiran ${currentSlide + 1}`}
                                            className="w-full h-full object-contain"
                                        />

                                        {/* Navigation Buttons */}
                                        {images.length > 1 && (
                                            <>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault()
                                                        setCurrentSlide(prev => Math.max(0, prev - 1))
                                                    }}
                                                    disabled={currentSlide === 0}
                                                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full disabled:opacity-0 transition-all"
                                                >
                                                    ◀
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault()
                                                        setCurrentSlide(prev => Math.min(images.length - 1, prev + 1))
                                                    }}
                                                    disabled={currentSlide === images.length - 1}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full disabled:opacity-0 transition-all"
                                                >
                                                    ▶
                                                </button>
                                            </>
                                        )}

                                        {/* View Full Button */}
                                        <a
                                            href={images[currentSlide]}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 text-white text-xs px-4 py-2 rounded-full backdrop-blur-sm transition-all font-bold shadow-lg flex items-center gap-2"
                                        >
                                            <span className="text-lg">🔍</span> Lihat Full
                                        </a>

                                        {/* Dots Indicator */}
                                        {images.length > 1 && (
                                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                                                {images.map((_, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`w-2 h-2 rounded-full transition-all ${idx === currentSlide ? 'bg-white scale-125' : 'bg-white/50'}`}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedRequest.status === 'PENDING' && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Catatan Penolakan (Jika ditolak)</label>
                                    <textarea
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Berikan alasan jika menolak..."
                                        rows={2}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => handleDelete()}
                                disabled={actionLoading}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold text-sm transition-colors disabled:opacity-50"
                            >
                                <MdDelete className="text-lg" />
                                Hapus
                            </button>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsActionModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-gray-600 bg-gray-100 hover:bg-gray-200 font-bold text-sm"
                                >
                                    Tutup
                                </button>

                                {selectedRequest.status === 'PENDING' && (
                                    <>
                                        <button
                                            onClick={() => handleAction('REJECTED')}
                                            disabled={actionLoading}
                                            className="px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 font-bold text-sm disabled:opacity-50"
                                        >
                                            Tolak
                                        </button>
                                        <button
                                            onClick={() => handleAction('APPROVED')}
                                            disabled={actionLoading}
                                            className="px-4 py-2 rounded-lg text-white bg-green-600 hover:bg-green-700 font-bold text-sm disabled:opacity-50"
                                        >
                                            Setujui
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

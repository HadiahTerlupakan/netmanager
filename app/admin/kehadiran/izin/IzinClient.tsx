'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { MdCheckCircle, MdCancel, MdPending, MdAdd, MdDelete } from 'react-icons/md'
import toast from 'react-hot-toast'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'

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

export function IzinClient() {
    const { hasPermission } = usePermission()
    const canCreate = hasPermission('izin:create')
    const canVerify = hasPermission('izin:verify')
    const canDelete = hasPermission('izin:delete')

    const [leaves, setLeaves] = useState<LeaveRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState<string>('PENDING')

    const [isActionModalOpen, setIsActionModalOpen] = useState(false)
    const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
    const [rejectionReason, setRejectionReason] = useState('')
    const [actionLoading, setActionLoading] = useState(false)

    const [isManualModalOpen, setIsManualModalOpen] = useState(false)
    const [users, setUsers] = useState<User[]>([])
    const [manualForm, setManualForm] = useState({
        userId: '',
        type: 'SAKIT',
        startDate: '',
        endDate: '',
        reason: '',
        attachmentUrl: '',
        attachments: [] as string[]
    })
    const [uploading, setUploading] = useState(false)

    const [searchTerm, setSearchTerm] = useState('')

    const filteredUsers = users.filter(u =>
        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const fetchLeaves = useCallback(async () => {
        setLoading(true)
        try {
            const query = filterStatus === 'ALL' ? '' : `?status=${filterStatus}`
            const res = await fetch(`/api/admin/leaves${query}`)
            if (res.ok) {
                const data = await res.json()
                setLeaves(data)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }, [filterStatus])

    useEffect(() => {
        fetchLeaves()
    }, [fetchLeaves])

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users?limit=1000')
            if (res.ok) {
                const data = await res.json()
                setUsers(Array.isArray(data) ? data : data.users || [])
            }
        } catch (error) {
            console.error('Failed to fetch users', error)
        }
    }

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

    // Define columns for ResponsiveTable
    const columns: Column<LeaveRequest>[] = [
        {
            key: 'user',
            header: 'Karyawan',
            priority: 'primary',
            render: (req) => (
                <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                        {req.user.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <div className="font-bold text-gray-900 dark:text-white">{req.user.name}</div>
                        <div className="text-xs text-gray-500">{req.user.department?.name} - {req.user.site?.name}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'type',
            header: 'Tipe',
            priority: 'secondary',
            render: (req) => <span className="font-medium">{req.type}</span>
        },
        {
            key: 'tanggal',
            header: 'Tanggal',
            priority: 'primary',
            render: (req) => (
                <span className="text-gray-500">
                    {format(new Date(req.startDate), 'dd MMM yyyy', { locale: id })} - {format(new Date(req.endDate), 'dd MMM yyyy', { locale: id })}
                </span>
            )
        },
        {
            key: 'reason',
            header: 'Alasan',
            priority: 'tertiary',
            render: (req) => (
                <span className="text-gray-500 truncate max-w-xs block" title={req.reason}>{req.reason}</span>
            )
        },
        {
            key: 'status',
            header: 'Status',
            priority: 'primary',
            render: (req) => getStatusBadge(req.status)
        }
    ]

    // Render actions for each row
    const renderActions = (req: LeaveRequest) => (
        <>
            <button
                onClick={() => openActionModal(req)}
                className="text-blue-600 hover:text-blue-800 font-bold text-xs"
            >
                Detail
            </button>
            {canDelete && (
                <>
                    <span className="text-gray-300">|</span>
                    <button
                        onClick={() => handleDelete(req.id)}
                        className="text-red-500 hover:text-red-700"
                    >
                        <MdDelete className="text-lg" />
                    </button>
                </>
            )}
        </>
    )

    return (
        <div className="p-6">
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Manajemen Izin & Cuti</h1>
                    <p className="text-gray-500 text-sm">Kelola pengajuan izin, sakit, dan cuti karyawan</p>
                </div>
                {canCreate && (
                    <button
                        onClick={handleOpenManualModal}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm flex items-center gap-2"
                    >
                        <MdAdd className="size-5" /> Input Manual
                    </button>
                )}
            </div>

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

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
                <ResponsiveTable
                    data={leaves}
                    columns={columns}
                    keyField="id"
                    loading={loading}
                    emptyMessage="Tidak ada pengajuan ditemukan."
                    loadingMessage="Memuat data..."
                    renderActions={renderActions}
                />
            </div>
            {/* Action Modal (Detail & Approval) */}
            {isActionModalOpen && selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#1c2936] w-full max-w-lg rounded-xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg dark:text-white">Detail Pengajuan Izin</h3>
                            <button onClick={() => setIsActionModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                                <MdCancel className="text-2xl" />
                            </button>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="size-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
                                    {selectedRequest.user.name?.charAt(0) || 'U'}
                                </div>
                                <div>
                                    <h4 className="font-bold dark:text-white">{selectedRequest.user.name}</h4>
                                    <p className="text-sm text-gray-500">{selectedRequest.user.department?.name} - {selectedRequest.user.site?.name}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Tipe Izin</label>
                                    <div className="font-medium dark:text-white">{selectedRequest.type}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Status</label>
                                    <div>{getStatusBadge(selectedRequest.status)}</div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs text-gray-500 block mb-1">Tanggal</label>
                                    <div className="font-medium dark:text-white">
                                        {format(new Date(selectedRequest.startDate), 'dd MMM yyyy', { locale: id })} - {format(new Date(selectedRequest.endDate), 'dd MMM yyyy', { locale: id })}
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs text-gray-500 block mb-1">Alasan</label>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm dark:text-gray-300">
                                        {selectedRequest.reason}
                                    </div>
                                </div>
                                {selectedRequest.attachmentUrl && (
                                    <div className="col-span-2">
                                        <label className="text-xs text-gray-500 block mb-1">Lampiran</label>
                                        <a
                                            href={selectedRequest.attachmentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline text-sm flex items-center gap-2"
                                        >
                                            Lihat Lampiran ↗
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedRequest.status === 'PENDING' && canVerify && (
                            <div className="border-t pt-4 dark:border-gray-700">
                                <div className="mb-4">
                                    <label className="block text-sm font-medium mb-2 dark:text-gray-300">Alasan Penolakan (Jika menolak)</label>
                                    <textarea
                                        className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                        rows={2}
                                        placeholder="Wajib diisi jika menolak..."
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleAction('REJECTED')}
                                        disabled={actionLoading || !rejectionReason.trim()}
                                        className="flex-1 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-bold disabled:opacity-50 flex justify-center items-center gap-2"
                                    >
                                        <MdCancel /> Tolak
                                    </button>
                                    <button
                                        onClick={() => handleAction('APPROVED')}
                                        disabled={actionLoading}
                                        className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold disabled:opacity-50 flex justify-center items-center gap-2"
                                    >
                                        <MdCheckCircle /> Setujui
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* If not pending or cannot verify, just show close/delete */}
                        {(!canVerify || selectedRequest.status !== 'PENDING') && (
                             <div className="flex justify-end gap-2 border-t pt-4 dark:border-gray-700">
                                {canDelete && (
                                    <button
                                        onClick={() => handleDelete(selectedRequest.id)}
                                        disabled={actionLoading}
                                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium flex items-center gap-2"
                                    >
                                        <MdDelete /> Hapus
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsActionModalOpen(false)}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium dark:bg-gray-700 dark:text-gray-300"
                                >
                                    Tutup
                                </button>
                             </div>
                        )}
                    </div>
                </div>
            )}

            {/* Manual Input Modal */}
            {isManualModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#1c2936] w-full max-w-lg rounded-xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg dark:text-white">Input Izin Manual</h3>
                            <button onClick={() => setIsManualModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                                <MdCancel className="text-2xl" />
                            </button>
                        </div>

                        <form onSubmit={handleManualSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Karyawan</label>
                                <div className="relative">
                                    <input 
                                        type="text"
                                        className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                        placeholder="Cari karyawan..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        onClick={() => fetchUsers()}
                                    />
                                    {searchTerm && (
                                        <div className="absolute z-10 w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                                            {filteredUsers.map(u => (
                                                <div 
                                                    key={u.id}
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer dark:text-gray-300"
                                                    onClick={() => {
                                                        setManualForm(prev => ({...prev, userId: u.id}))
                                                        setSearchTerm(u.name)
                                                    }}
                                                >
                                                    {u.name} <span className="text-xs text-gray-500">({u.email})</span>
                                                </div>
                                            ))}
                                            {filteredUsers.length === 0 && (
                                                <div className="p-2 text-gray-500 text-sm text-center">Tidak ditemukan</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Tipe Izin</label>
                                    <select
                                        className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                        value={manualForm.type}
                                        onChange={e => setManualForm({...manualForm, type: e.target.value})}
                                    >
                                        <option value="SAKIT">Sakit</option>
                                        <option value="IZIN">Izin</option>
                                        <option value="CUTI">Cuti</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Lampiran</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        className="w-full p-1 text-sm dark:text-gray-300"
                                    />
                                    {uploading && <span className="text-xs text-blue-500">Uploading...</span>}
                                    {manualForm.attachmentUrl && <span className="text-xs text-green-500">Terupload ✓</span>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Mulai</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                        value={manualForm.startDate}
                                        onChange={e => setManualForm({...manualForm, startDate: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Selesai</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                        value={manualForm.endDate}
                                        onChange={e => setManualForm({...manualForm, endDate: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Alasan</label>
                                <textarea
                                    className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                    rows={3}
                                    value={manualForm.reason}
                                    onChange={e => setManualForm({...manualForm, reason: e.target.value})}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsManualModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading || uploading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {actionLoading ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { MdCheckCircle, MdCancel, MdPending, MdAdd, MdDelete } from 'react-icons/md'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'
import { Modal, ModalFooter } from '@/components/ui/Modal'

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
    approvedBy?: string // 'SYSTEM_AUTO' for auto-approval, or admin user ID
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
    const [showDropdown, setShowDropdown] = useState(false)

    const filteredUsers = (users || []).filter(u =>
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
                // apiSuccess returns { success: true, data: [...] }
                // Check if data.data exists (wrapped) or use data directly (unwrapped legacy)
                const leavesData = Array.isArray(data) ? data : (data.data || [])
                setLeaves(leavesData)
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
                // apiSuccess returns { success: true, data: { users: [...] } }
                // Need to unwrap properly. data.data.users might be where the array is.
                const usersList = Array.isArray(data) ? data : (data.users || data.data?.users || [])
                setUsers(usersList)
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

        if (new Date(manualForm.startDate) > new Date(manualForm.endDate)) {
            toast.error('Tanggal selesai harus setelah atau sama dengan tanggal mulai')
            return
        }

        setActionLoading(true)
        try {
            // Prepare payload - handle empty attachmentUrl
            const payload = {
                ...manualForm,
                attachmentUrl: manualForm.attachmentUrl || undefined
            }

            const res = await fetch('/api/admin/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                toast.success('Pengajuan manual berhasil dibuat')
                setIsManualModalOpen(false)
                setManualForm({ userId: '', type: 'SAKIT', startDate: '', endDate: '', reason: '', attachmentUrl: '', attachments: [] })
                setSearchTerm('')
                fetchLeaves()
            } else {
                const err = await res.json()
                // Display more detailed error if available
                if (err.details) {
                    const detailsMsg = Object.values(err.details).flat().join(', ')
                    toast.error(`Gagal: ${detailsMsg}`)
                } else {
                    toast.error(err.error || 'Gagal membuat pengajuan')
                }
            }
        } catch (_error) {
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
            <Button onClick={() => openActionModal(req)}
                variant="link" className="font-bold text-xs p-0 h-auto"
            >
                Detail
            </Button>
            {canDelete && (
                <>
                    <span className="text-gray-300">|</span>
                    <Button onClick={() => handleDelete(req.id)}
                        variant="ghost" size="icon-sm" className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50"
                    >
                        <MdDelete className="text-lg" />
                    </Button>
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
                    <Button
                        onClick={handleOpenManualModal}
                        variant="default"
                    >
                        <MdAdd className="size-5 mr-2" /> Input Manual
                    </Button>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex gap-2 overflow-x-auto">
                {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((status) => (
                    <Button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        variant={filterStatus === status ? "default" : "secondary"}
                        className="rounded-lg whitespace-nowrap"
                    >
                        {status === 'ALL' ? 'Semua' : status === 'PENDING' ? 'Menunggu Konfirmasi' : status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                    </Button>
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
            <Modal
                isOpen={isActionModalOpen}
                onClose={() => setIsActionModalOpen(false)}
                title="Detail Pengajuan Izin"
                size="lg"
            >
                {selectedRequest && (
                    <>
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                <div className="size-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl shrink-0">
                                    {selectedRequest.user.name?.charAt(0) || 'U'}
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">{selectedRequest.user.name}</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedRequest.user.department?.name} - {selectedRequest.user.site?.name}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Tipe Izin</label>
                                    <div className="font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700">
                                        {selectedRequest.type}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Status</label>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(selectedRequest.status)}
                                        {selectedRequest.status === 'APPROVED' && selectedRequest.approvedBy && (
                                            <span className={`text-xs px-2 py-1 rounded-full border ${selectedRequest.approvedBy === 'SYSTEM_AUTO'
                                                ? 'bg-purple-50 text-purple-700 border-purple-100'
                                                : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                {selectedRequest.approvedBy === 'SYSTEM_AUTO' ? '🤖 Auto System' : '👤 Admin'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Tanggal</label>
                                    <div className="font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700">
                                        {format(new Date(selectedRequest.startDate), 'dd MMMM yyyy', { locale: id })} - {format(new Date(selectedRequest.endDate), 'dd MMMM yyyy', { locale: id })}
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Alasan</label>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-700 leading-relaxed">
                                        {selectedRequest.reason}
                                    </div>
                                </div>
                                {selectedRequest.attachmentUrl && (
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Lampiran</label>
                                        <a
                                            href={selectedRequest.attachmentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium border border-blue-100"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                            Lihat Lampiran
                                        </a>
                                    </div>
                                )}
                            </div>

                            {selectedRequest.status === 'PENDING' && canVerify && (
                                <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Alasan Penolakan (Jika menolak)</label>
                                        <textarea
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                                            rows={2}
                                            placeholder="Wajib diisi jika menolak pengajuan..."
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <ModalFooter>
                            {selectedRequest.status === 'PENDING' && canVerify ? (
                                <>
                                    <Button onClick={() => handleAction('REJECTED')}
                                        disabled={actionLoading || !rejectionReason.trim()}
                                        variant="destructive"
                                    >
                                        <MdCancel className="text-lg" /> Tolak
                                    </Button>
                                    <Button onClick={() => handleAction('APPROVED')}
                                        disabled={actionLoading}
                                        variant="success"
                                    >
                                        <MdCheckCircle className="text-lg" /> Setujui
                                    </Button>
                                </>
                            ) : (
                                <div className="flex gap-2 w-full justify-end">
                                    {canDelete && (
                                        <Button onClick={() => handleDelete(selectedRequest.id)}
                                            disabled={actionLoading}
                                            variant="ghost" className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 mr-auto"
                                        >
                                            <MdDelete className="text-lg" /> Hapus
                                        </Button>
                                    )}
                                    <Button onClick={() => setIsActionModalOpen(false)}
                                        variant="secondary"
                                    >
                                        Tutup
                                    </Button>
                                </div>
                            )}
                        </ModalFooter>
                    </>
                )}
            </Modal>

            {/* Manual Input Modal */}
            <Modal
                isOpen={isManualModalOpen}
                onClose={() => setIsManualModalOpen(false)}
                title="Input Izin Manual"
                size="lg"
            >
                <form onSubmit={handleManualSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Karyawan</label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                placeholder="Ketik nama karyawan..."
                                value={searchTerm}
                                onChange={e => {
                                    setSearchTerm(e.target.value)
                                    setShowDropdown(true)
                                    // Clear userId if user starts typing again
                                    if (manualForm.userId) {
                                        setManualForm(prev => ({ ...prev, userId: '' }))
                                    }
                                }}
                                onClick={() => {
                                    fetchUsers()
                                    setShowDropdown(true)
                                }}
                            />
                            {showDropdown && searchTerm && (
                                <div className="absolute z-10 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-xl">
                                    {filteredUsers?.map(u => (
                                        <div
                                            key={u.id}
                                            className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-gray-900 dark:text-gray-200 border-b border-gray-50 dark:border-gray-700 last:border-0"
                                            onClick={() => {
                                                setManualForm(prev => ({...prev, userId: u.id}))
                                                setSearchTerm(u.name)
                                                setShowDropdown(false)
                                            }}
                                        >
                                            <div className="font-medium">{u.name}</div>
                                            <div className="text-xs text-gray-500">{u.email}</div>
                                        </div>
                                    ))}
                                    {(filteredUsers?.length === 0) && (
                                        <div className="p-4 text-gray-500 text-sm text-center">Karyawan tidak ditemukan</div>
                                    )}
                                </div>
                            )}
                        </div>
                        {manualForm.userId && (
                            <div className="mt-1 text-xs text-green-600 font-medium flex items-center gap-1">
                                <MdCheckCircle /> Karyawan terpilih
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Tipe Izin</label>
                            <select
                                className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                value={manualForm.type}
                                onChange={e => setManualForm({...manualForm, type: e.target.value})}
                            >
                                <option value="SAKIT">Sakit</option>
                                <option value="IZIN">Izin</option>
                                <option value="CUTI">Cuti</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Lampiran</label>
                            <div className="flex items-center gap-2">
                                <label className="flex-1 cursor-pointer">
                                    <div className="w-full p-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-center text-sm text-gray-500 hover:bg-gray-100 transition-colors">
                                        {uploading ? 'Mengupload...' : 'Pilih File'}
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                </label>
                                {manualForm.attachmentUrl && (
                                    <a href={manualForm.attachmentUrl} target="_blank" rel="noreferrer" className="p-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100">
                                        Lihat
                                    </a>
                                )}
                            </div>
                            {manualForm.attachmentUrl && <span className="text-xs text-green-600 mt-1 block">✓ Terupload</span>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Mulai</label>
                            <input
                                type="date"
                                className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                value={manualForm.startDate}
                                onChange={e => setManualForm({...manualForm, startDate: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Selesai</label>
                            <input
                                type="date"
                                className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                value={manualForm.endDate}
                                onChange={e => setManualForm({...manualForm, endDate: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Alasan</label>
                        <textarea
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            rows={3}
                            placeholder="Jelaskan alasan pengajuan..."
                            value={manualForm.reason}
                            onChange={e => setManualForm({...manualForm, reason: e.target.value})}
                        />
                    </div>

                    <ModalFooter>
                        <Button type="button"
                            onClick={() => setIsManualModalOpen(false)}
                            variant="ghost"
                        >
                            Batal
                        </Button>
                        <Button type="submit"
                            disabled={actionLoading || uploading}
                            
                        >
                            {actionLoading ? 'Menyimpan...' : 'Simpan Data'}
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>
        </div>
    )
}

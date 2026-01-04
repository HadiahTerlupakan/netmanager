'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { MdCheckCircle, MdCancel, MdPending, MdAdd, MdDelete } from 'react-icons/md'
import toast from 'react-hot-toast'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'

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
            <span className="text-gray-300">|</span>
            <button
                onClick={() => handleDelete(req.id)}
                className="text-red-500 hover:text-red-700"
            >
                <MdDelete className="text-lg" />
            </button>
        </>
    )

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
        </div>
    )
}

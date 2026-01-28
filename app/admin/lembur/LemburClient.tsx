'use client'

import { useEffect, useState } from 'react'
import { MdCheckCircle, MdCancel, MdPending, MdAccessTime, MdTimer, MdDoneAll, MdPlayArrow, MdLocationOn, MdDelete, MdEdit } from 'react-icons/md'
import { FaSearch, FaCalendarAlt, FaBuilding } from 'react-icons/fa'
import Image from 'next/image'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'

interface Overtime {
    id: string
    createdAt: string
    duration: number | null
    reason: string
    status: 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED'
    rejectionReason?: string
    startTime?: string
    endTime?: string
    startPhoto?: string
    endPhoto?: string
    startLocation?: string
    endLocation?: string
    // Holiday/Off-day tracking
    isHolidayOvertime?: boolean
    isNationalHoliday?: boolean
    isOffDay?: boolean
    holidayDescription?: string
    user: {
        name: string
        email: string
        image?: string
        workDays?: string
        workingHourMode?: string
        sites?: { name: string }
        departments?: { name: string }
    }
}



export function ClientComponent() {
    const { hasPermission } = usePermission()
    const canVerify = hasPermission('lembur:verify')
    const canUpdate = hasPermission('lembur:update')
    const canDelete = hasPermission('lembur:delete')

    const [requests, setRequests] = useState<Overtime[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [rejectId, setRejectId] = useState<string | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

    // Edit State
    const [editId, setEditId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState({ reason: '', startTime: '', endTime: '' })

    // Pagination & Stats
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalItems, setTotalItems] = useState(0)
    const [summary, setSummary] = useState<Record<string, number>>({})

    // Filters
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [siteId, setSiteId] = useState('')
    const [departmentId, setDepartmentId] = useState('')
    const [holidayFilter, setHolidayFilter] = useState('')

    // Options
    const [sites, setSites] = useState<{ id: string, name: string }[]>([])
    const [departments, setDepartments] = useState<{ id: string, name: string }[]>([])

    useEffect(() => {
        fetchOptions()
        fetchRequests()
    }, [])

    // Fetch on filter change (debounce could be better but direct for now)
    useEffect(() => {
        if (!isLoading) fetchRequests()
    }, [page, startDate, endDate, statusFilter, siteId, departmentId, holidayFilter])

    const fetchOptions = async () => {
        try {
            const res = await fetch('/api/admin/options')
            if (res.ok) {
                const data = await res.json()
                const options = data.data || data
                setSites(options.sites || [])
                setDepartments(options.departments || [])
            }
        } catch (error) {
            console.error('Failed to fetch options')
        }
    }

    const fetchRequests = async () => {
        setIsLoading(true)
        try {
            const query = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                ...(startDate && { startDate }),
                ...(endDate && { endDate }),
                ...(statusFilter && { status: statusFilter }),
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            })

            const res = await fetch(`/api/admin/lembur?${query.toString()}`)
            if (res.ok) {
                const data = await res.json()
                let filteredData = data.data
                
                // Client-side filter by holiday type
                if (holidayFilter) {
                    filteredData = filteredData.filter((item: Overtime) => {
                        switch (holidayFilter) {
                            case 'REGULAR': return !item.isHolidayOvertime
                            case 'NATIONAL': return item.isNationalHoliday
                            case 'COLLECTIVE': return item.isHolidayOvertime && !item.isNationalHoliday && !item.isOffDay
                            case 'OFFDAY': return item.isOffDay
                            case 'ALL_HOLIDAY': return item.isHolidayOvertime
                            default: return true
                        }
                    })
                }
                
                setRequests(filteredData)
                setTotalPages(data.pagination?.totalPages || 1)
                setTotalItems(holidayFilter ? filteredData.length : (data.pagination?.total || 0))
                if (data.summary) setSummary(data.summary)
            }
        } catch (error) {
            console.error('Failed to fetch requests:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAction = async (id: string, action: 'approve' | 'reject', reason?: string) => {
        setProcessingId(id)
        try {
            const res = await fetch(`/api/admin/lembur/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, reason })
            })

            if (res.ok) {
                await fetchRequests()
                if (action === 'reject') {
                    setRejectId(null)
                    setRejectReason('')
                }
            } else {
                const data = await res.json()
                alert(data.error || 'Gagal memproses permintaan')
            }
        } catch (error) {
            console.error('Action failed:', error)
        } finally {
            setProcessingId(null)
        }
    }

    const openEditModal = (item: Overtime) => {
        setEditId(item.id)
        // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
        const formatForInput = (dateStr?: string) => {
            if (!dateStr) return ''
            const d = new Date(dateStr)
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset()) // Adjust to local
            return d.toISOString().slice(0, 16)
        }

        setEditForm({
            reason: item.reason,
            startTime: formatForInput(item.startTime),
            endTime: formatForInput(item.endTime)
        })
    }

    const handleEditSubmit = async () => {
        if (!editId) return
        setProcessingId(editId)
        try {
            // Convert back to ISO strings or nulls
            const payload: any = { reason: editForm.reason }
            if (editForm.startTime) payload.startTime = new Date(editForm.startTime).toISOString()
            if (editForm.endTime) payload.endTime = new Date(editForm.endTime).toISOString()

            const res = await fetch(`/api/admin/lembur/${editId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                await fetchRequests()
                setEditId(null)
            } else {
                const data = await res.json()
                alert(data.error || 'Gagal mengupdate data')
            }
        } catch (error) {
            console.error('Update failed:', error)
        } finally {
            setProcessingId(null)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus data lembur ini?')) return

        setProcessingId(id)
        try {
            const res = await fetch(`/api/admin/lembur/${id}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                await fetchRequests()
            } else {
                const data = await res.json()
                alert(data.error || 'Gagal menghapus data')
            }
        } catch (error) {
            console.error('Delete failed:', error)
        } finally {
            setProcessingId(null)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        <MdCheckCircle /> Disetujui
                    </span>
                )
            case 'IN_PROGRESS':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 animate-pulse">
                        <MdPlayArrow /> Sedang Berjalan
                    </span>
                )
            case 'COMPLETED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        <MdDoneAll /> Selesai
                    </span>
                )
            case 'REJECTED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                        <MdCancel /> Ditolak
                    </span>
                )
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                        <MdPending /> Menunggu
                    </span>
                )
        }
    }

    // Define columns for ResponsiveTable
    const columns: Column<Overtime>[] = [
        {
            key: 'user',
            header: 'Karyawan',
            priority: 'primary',
            render: (item) => (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 relative">
                        {item.user.image ? (
                            <Image src={item.user.image} alt="" fill className="object-cover rounded-full" />
                        ) : (
                            <span className="font-bold text-xs">{item.user.name?.charAt(0) || 'U'}</span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{item.user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{item.user.email}</p>
                    </div>
                </div>
            )
        },
        {
            key: 'siteDept',
            header: 'Site/Dept',
            priority: 'secondary',
            render: (item) => (
                <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{item.user.sites?.name || '-'}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                        <FaBuilding className="text-[10px]" /> {item.user.departments?.name || '-'}
                    </div>
                </div>
            )
        },

        {
            key: 'tanggalAlasan',
            header: 'Tanggal & Alasan',
            priority: 'primary',
            render: (item) => {
                const date = new Date(item.createdAt)
                const dayName = date.toLocaleDateString('id-ID', { weekday: 'long' })
                const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                
                return (
                    <div className="text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-2 flex-wrap">
                            <div>
                                <span className="text-sm font-medium">{dateStr}</span>
                                <span className="text-xs text-gray-500 ml-1">({dayName})</span>
                            </div>
                            {/* Holiday/Off-day Badge */}
                            {item.isHolidayOvertime && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                    item.isNationalHoliday 
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        : item.isOffDay 
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                }`} title={item.holidayDescription}>
                                    {item.isNationalHoliday ? '🎌 Libur Nasional' 
                                        : item.isOffDay ? '📅 Hari Libur' 
                                        : '🏖️ Cuti Bersama'}
                                </span>
                            )}
                        </div>
                        <p className="text-xs mt-1 max-w-[150px] truncate" title={item.reason}>
                            &quot;{item.reason}&quot;
                        </p>
                        {item.rejectionReason && (
                            <p className="text-xs text-red-500 mt-1 italic truncate" title={item.rejectionReason}>
                                Ket: {item.rejectionReason}
                            </p>
                        )}
                    </div>
                )
            }
        },

        {
            key: 'waktuLembur',
            header: 'Waktu Lembur',
            priority: 'secondary',
            render: (item) => (
                <div className="flex flex-col gap-1 text-xs">
                    {item.startTime ? (
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-green-600">Start:</span>
                            {new Date(item.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    ) : <span className="text-gray-400 italic">Belum mulai</span>}
                    {item.endTime && (
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-red-600">End:</span>
                            {new Date(item.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    )}
                    {item.duration != null && (
                        <span className="text-purple-600 font-bold mt-1 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded w-fit">
                            {item.duration} Menit
                        </span>
                    )}
                </div>
            )
        },
        {
            key: 'lokasi',
            header: 'Lokasi',
            priority: 'tertiary',
            render: (item) => (
                <div className="flex flex-col gap-2 max-w-[180px]">
                    {item.startLocation ? (
                        <a
                            href={`https://www.google.com/maps?q=${item.startLocation}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors group"
                            title={`Lokasi Mulai: ${item.startLocation}`}
                        >
                            <MdLocationOn className="text-green-600 shrink-0" />
                            <span className="text-xs group-hover:underline font-medium">Mulai</span>
                        </a>
                    ) : <span className="text-xs text-gray-400">-</span>}
                    {item.endLocation && (
                        <a
                            href={`https://www.google.com/maps?q=${item.endLocation}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors group"
                            title={`Lokasi Selesai: ${item.endLocation}`}
                        >
                            <MdLocationOn className="text-red-600 shrink-0" />
                            <span className="text-xs group-hover:underline font-medium">Selesai</span>
                        </a>
                    )}
                </div>
            )
        },
        {
            key: 'status',
            header: 'Status',
            priority: 'primary',
            render: (item) => getStatusBadge(item.status)
        },
        {
            key: 'foto',
            header: 'Foto',
            priority: 'tertiary',
            render: (item) => (
                <div className="flex gap-2">
                    {item.startPhoto && (
                        <button onClick={() => setSelectedPhoto(item.startPhoto!)} className="relative group" title="Foto Mulai">
                            <div className="w-8 h-8 rounded bg-gray-200 overflow-hidden ring-1 ring-gray-300 dark:ring-gray-600 hover:ring-green-500 transition-all relative">
                                <Image src={item.startPhoto} alt="Start" fill className="object-cover" />
                            </div>
                        </button>
                    )}
                    {item.endPhoto && (
                        <button onClick={() => setSelectedPhoto(item.endPhoto!)} className="relative group" title="Foto Selesai">
                            <div className="w-8 h-8 rounded bg-gray-200 overflow-hidden ring-1 ring-gray-300 dark:ring-gray-600 hover:ring-red-500 transition-all relative">
                                <Image src={item.endPhoto} alt="End" fill className="object-cover" />
                            </div>
                        </button>
                    )}
                    {!item.startPhoto && !item.endPhoto && <span className="text-xs text-gray-400">-</span>}
                </div>
            )
        }
    ]

    // Render actions for each row
    const renderActions = (item: Overtime) => (
        <>
            {item.status === 'PENDING' && canVerify && (
                <>
                    <button
                        onClick={() => handleAction(item.id, 'approve')}
                        disabled={processingId === item.id}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Setujui (Verify)"
                    >
                        <MdCheckCircle className="text-lg" />
                    </button>
                    <button
                        onClick={() => setRejectId(item.id)}
                        disabled={processingId === item.id}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Tolak (Verify)"
                    >
                        <MdCancel className="text-lg" />
                    </button>
                </>
            )}
            {canUpdate && (
                <button
                    onClick={() => openEditModal(item)}
                    disabled={processingId === item.id}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Edit Data"
                >
                    <MdEdit className="text-lg" />
                </button>
            )}
            {canDelete && (
                <button
                    onClick={() => handleDelete(item.id)}
                    disabled={processingId === item.id}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Hapus"
                >
                    <MdDelete className="text-lg" />
                </button>
            )}
        </>
    )

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Manajemen Lembur</h1>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {Object.entries(summary).map(([key, count]) => (
                    <div key={key} className="bg-white p-4 rounded-lg shadow border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                        <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">{key.toLowerCase().replace('_', ' ')}</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{count}</div>
                    </div>
                ))}
                <div className="bg-indigo-50 p-4 rounded-lg shadow border border-indigo-100 dark:bg-indigo-900/20">
                    <div className="text-sm text-indigo-600 dark:text-indigo-400">Total Filtered</div>
                    <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{totalItems}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow dark:bg-gray-800 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Dari Tanggal</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                        className="border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Sampai Tanggal</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                        className="border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Site</label>
                    <select
                        value={siteId}
                        onChange={(e) => { setSiteId(e.target.value); setPage(1); }}
                        className="border rounded px-3 py-2 text-sm w-40 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">Semua Site</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Departemen</label>
                    <select
                        value={departmentId}
                        onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }}
                        className="border rounded px-3 py-2 text-sm w-40 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">Semua Dept</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Status</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="border rounded px-3 py-2 text-sm w-40 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">Semua Status</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Tipe Hari</label>
                    <select
                        value={holidayFilter}
                        onChange={(e) => { setHolidayFilter(e.target.value); setPage(1); }}
                        className="border rounded px-3 py-2 text-sm w-44 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">Semua Hari</option>
                        <option value="REGULAR">Hari Kerja</option>
                        <option value="ALL_HOLIDAY">Semua Libur</option>
                        <option value="NATIONAL">🎌 Libur Nasional</option>
                        <option value="COLLECTIVE">🏖️ Cuti Bersama</option>
                        <option value="OFFDAY">📅 Hari Libur Karyawan</option>
                    </select>
                </div>
                <button
                    onClick={() => fetchRequests()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm h-[38px] flex items-center gap-2"
                >
                    <FaSearch /> Cari
                </button>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <ResponsiveTable
                    data={requests}
                    columns={columns}
                    keyField="id"
                    loading={isLoading}
                    emptyMessage="Tidak ada data pengajuan lembur yang sesuai filter."
                    loadingMessage="Memuat data..."
                    renderActions={renderActions}
                />

                {/* Pagination Controls */}
                <div className="px-6 py-3 flex flex-col sm:flex-row justify-between items-center border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 gap-3">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1 border rounded bg-white disabled:opacity-50 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                        Sebelumnya
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Halaman {page} dari {totalPages} ({totalItems} Data)</span>
                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1 border rounded bg-white disabled:opacity-50 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                        Selanjutnya
                    </button>
                </div>
            </div>

            {/* Reject Modal */}
            {rejectId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#1c2936] w-full max-w-sm rounded-xl p-4 shadow-xl">
                        <h3 className="font-bold text-lg mb-3 dark:text-white">Alasan Penolakan</h3>
                        <textarea
                            className="w-full p-2 border rounded-lg mb-3 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                            rows={3}
                            placeholder="Wajib diisi..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => { setRejectId(null); setRejectReason(''); }}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => handleAction(rejectId, 'reject', rejectReason)}
                                disabled={!rejectReason.trim() || processingId === rejectId}
                                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                Tolak
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#1c2936] w-full max-w-md rounded-xl p-6 shadow-xl">
                        <h3 className="font-bold text-lg mb-4 dark:text-white">Edit Data Lembur</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Alasan Lembur</label>
                                <textarea
                                    className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                    rows={3}
                                    value={editForm.reason}
                                    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Jam Mulai</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full p-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                        value={editForm.startTime}
                                        onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Jam Selesai</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full p-2 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                        value={editForm.endTime}
                                        onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setEditId(null)}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleEditSubmit}
                                disabled={processingId === editId}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                Simpan Perubahan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Modal */}
            {selectedPhoto && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setSelectedPhoto(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
                        <Image src={selectedPhoto} alt="Full view" fill className="object-contain" />
                        <button
                            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 bg-black/50 rounded-full"
                            onClick={() => setSelectedPhoto(null)}
                        >
                            <MdCancel size={24} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

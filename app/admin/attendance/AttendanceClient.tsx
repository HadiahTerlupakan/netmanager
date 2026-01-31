'use client'

import { useState, useEffect, useCallback } from 'react'
import { FaSearch, FaFileExport, FaBuilding } from 'react-icons/fa'
import { MdDelete, MdCancel, MdLocationOn, MdEdit, MdSave, MdTimer } from 'react-icons/md'
import Image from 'next/image'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import { fetchWithHandling, isFetchError, formatErrorMessage } from '@/lib/utils/fetch-wrapper'
import { formatForDateTimeInput, toISOString, formatDateDisplay, formatTimeDisplay } from '@/lib/utils/datetime'
import { validateDateRange, validateRequired } from '@/lib/utils/validation'

interface Attendance {
    id: string
    checkIn: string
    checkOut: string | null
    checkInPhoto: string | null
    checkOutPhoto: string | null
    checkOutLocation: string | null
    status: string
    notes: string | null
    location: string | null
    user: {
        name: string | null
        email: string
        image: string | null
        departments: {
            name: string
        } | null
        sites?: {
            name: string
        } | null
    }
}

export function ClientComponent() {
    const { hasPermission } = usePermission()
    const { showToast } = useToast()
    const canUpdate = hasPermission('attendance:update')
    const canDelete = hasPermission('attendance:delete')

    const [attendances, setAttendances] = useState<Attendance[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalItems, setTotalItems] = useState(0)
    const [retryCountdown, setRetryCountdown] = useState<number | null>(null)

    // Options
    const [sites, setSites] = useState<{ id: string, name: string }[]>([])
    const [departments, setDepartments] = useState<{ id: string, name: string }[]>([])

    // Filters
    const [startDate, setStartDate] = useState(() => {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        return `${year}-${month}-01`
    })
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [siteId, setSiteId] = useState('')
    const [departmentId, setDepartmentId] = useState('')

    // Debounced filters
    const debouncedStartDate = useDebounce(startDate, 300)
    const debouncedEndDate = useDebounce(endDate, 300)
    const debouncedSiteId = useDebounce(siteId, 300)
    const debouncedDepartmentId = useDebounce(departmentId, 300)

    // Summary
    const [summary, setSummary] = useState<Record<string, number>>({})

    // Handle rate limit countdown
    useEffect(() => {
        if (retryCountdown !== null && retryCountdown > 0) {
            const timer = setTimeout(() => setRetryCountdown(retryCountdown - 1), 1000)
            return () => clearTimeout(timer)
        } else if (retryCountdown === 0) {
            setRetryCountdown(null)
        }
    }, [retryCountdown])

    const fetchOptions = useCallback(async () => {
        try {
            const response = await fetchWithHandling<{ sites: { id: string, name: string }[], departments: { id: string, name: string }[] }>('/api/admin/options')
            if (response.data) {
                setSites(response.data.sites || [])
                setDepartments(response.data.departments || [])
            }
        } catch (error) {
            if (isFetchError(error)) {
                showToast('error', formatErrorMessage(error))
            }
        }
    }, [showToast])

    const fetchAttendances = useCallback(async () => {
        if (retryCountdown !== null) return

        // Validate date range
        const validation = validateDateRange(debouncedStartDate, debouncedEndDate)
        if (!validation.valid) {
            showToast('error', validation.error!)
            return
        }

        setLoading(true)
        try {
            const params: Record<string, string> = {
                page: page.toString(),
                limit: '10',
                startDate: debouncedStartDate,
                endDate: debouncedEndDate || '',
            }
            if (debouncedSiteId) params.siteId = debouncedSiteId
            if (debouncedDepartmentId) params.departmentId = debouncedDepartmentId

            const query = new URLSearchParams(params)

            const response = await fetchWithHandling<Attendance[]>(`/api/admin/attendance?${query.toString()}`)
            
            setAttendances(response.data || [])
            setTotalPages(response.pagination?.totalPages || 1)
            setTotalItems(response.pagination?.total || 0)
            if (response.summary) setSummary(response.summary)
        } catch (error) {
            if (isFetchError(error)) {
                if (error.retryAfter) {
                    setRetryCountdown(error.retryAfter)
                }
                showToast('error', formatErrorMessage(error))
            }
        } finally {
            setLoading(false)
        }
    }, [page, debouncedStartDate, debouncedEndDate, debouncedSiteId, debouncedDepartmentId, retryCountdown, showToast])

    useEffect(() => {
        fetchOptions()
    }, [fetchOptions])

    useEffect(() => {
        fetchAttendances()
    }, [fetchAttendances])

    const handleDelete = async (id: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus data absensi ini?')) return

        try {
            await fetchWithHandling(`/api/admin/attendance/${id}`, {
                method: 'DELETE'
            })
            
            showToast('success', 'Data absensi berhasil dihapus')
            fetchAttendances()
        } catch (error) {
            if (isFetchError(error)) {
                if (error.retryAfter) {
                    setRetryCountdown(error.retryAfter)
                }
                showToast('error', formatErrorMessage(error))
            }
        }
    }

    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

    const handleExport = () => {
        const params: Record<string, string> = {
            startDate,
            endDate: endDate || '',
            export: 'true'
        }
        if (siteId) params.siteId = siteId
        if (departmentId) params.departmentId = departmentId
        
        const query = new URLSearchParams(params)
        window.open(`/api/admin/attendance?${query.toString()}`, '_blank')
    }

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null)
    const [editForm, setEditForm] = useState({
        checkIn: '',
        checkOut: '',
        status: ''
    })
    const [editErrors, setEditErrors] = useState<Record<string, string>>({})

    const handleEditClick = (item: Attendance) => {
        setEditingAttendance(item)
        setEditErrors({})
        setEditForm({
            checkIn: formatForDateTimeInput(item.checkIn),
            checkOut: item.checkOut ? formatForDateTimeInput(item.checkOut) : '',
            status: item.status
        })
        setIsEditModalOpen(true)
    }

    const handleUpdate = async () => {
        if (!editingAttendance) return

        // Validate
        const errors: Record<string, string> = {}
        const checkInValid = validateRequired(editForm.checkIn, 'Jam Masuk')
        if (!checkInValid.valid) errors.checkIn = checkInValid.error!
        
        const statusValid = validateRequired(editForm.status, 'Status')
        if (!statusValid.valid) errors.status = statusValid.error!

        if (Object.keys(errors).length > 0) {
            setEditErrors(errors)
            return
        }

        try {
            await fetchWithHandling(`/api/admin/attendance/${editingAttendance.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    checkIn: toISOString(editForm.checkIn),
                    checkOut: editForm.checkOut ? toISOString(editForm.checkOut) : null,
                    status: editForm.status
                })
            })

            showToast('success', 'Data absensi berhasil diperbarui')
            setIsEditModalOpen(false)
            fetchAttendances()
        } catch (error) {
            if (isFetchError(error)) {
                if (error.retryAfter) {
                    setRetryCountdown(error.retryAfter)
                }
                showToast('error', formatErrorMessage(error))
            }
        }
    }

    // Define columns for ResponsiveTable
    const columns: Column<Attendance>[] = [
        {
            key: 'user',
            header: 'Karyawan',
            priority: 'primary',
            render: (item) => (
                <div className="flex items-center">
                    <div className="h-10 w-10 shrink-0 relative">
                        <Image
                            src={item.user.image || `https://ui-avatars.com/api/?name=${item.user.name}&background=random`}
                            alt="" fill className="rounded-full object-cover"
                        />
                    </div>
                    <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{item.user.name}</div>
                        <div className="text-xs text-gray-500">{item.user.email}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'sites',
            header: 'Site / Dept',
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
            key: 'checkIn',
            header: 'Tanggal',
            priority: 'primary',
            render: (item) => (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDateDisplay(item.checkIn)}
                </span>
            )
        },
        {
            key: 'jamKerja',
            header: 'Jam Kerja',
            priority: 'primary',
            render: (item) => {
                // ALPHA records should not show working hours
                if (item.status === 'ALPHA' || item.status === 'ABSENT') {
                    return (
                        <div className="text-sm text-gray-400 italic">
                            Tidak Masuk
                        </div>
                    )
                }
                
                return (
                    <div>
                        <div className="text-sm text-green-600 font-mono bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded inline-block mb-1">
                            IN: {formatTimeDisplay(item.checkIn)}
                        </div>
                        {item.checkOut ? (
                            <div className="text-sm text-red-600 font-mono bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded inline-block">
                                OUT: {formatTimeDisplay(item.checkOut)}
                            </div>
                        ) : (
                            <div className="text-xs text-gray-400 italic mt-1">Belum checkout</div>
                        )}
                    </div>
                )
            }
        },
        {
            key: 'durasi',
            header: 'Durasi',
            priority: 'primary',
            render: (item) => {
                if (item.status === 'ALPHA' || item.status === 'ABSENT' || !item.checkOut) {
                    return <span className="text-gray-400 text-sm">-</span>
                }
                
                const start = new Date(item.checkIn).getTime()
                const end = new Date(item.checkOut).getTime()
                const diffMs = end - start
                
                const hours = Math.floor(diffMs / (1000 * 60 * 60))
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                
                return (
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {hours}h {minutes}m
                    </span>
                )
            }
        },
        {
            key: 'location',
            header: 'Lokasi',
            priority: 'tertiary',
            render: (item) => (
                <div className="flex flex-col gap-1 max-w-[200px]">
                    {item.location ? (
                        <a
                            href={`https://www.google.com/maps?q=${item.location}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors group"
                            title={`Lokasi Masuk: ${item.location}`}
                        >
                            <MdLocationOn className="text-green-600 shrink-0" />
                            <span className="text-xs group-hover:underline font-medium">Lokasi Masuk</span>
                        </a>
                    ) : (
                        <span className="text-xs text-gray-400">-</span>
                    )}
                    {item.checkOutLocation && (
                        <a
                            href={`https://www.google.com/maps?q=${item.checkOutLocation}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors group"
                            title={`Lokasi Pulang: ${item.checkOutLocation}`}
                        >
                            <MdLocationOn className="text-red-500 shrink-0" />
                            <span className="text-xs group-hover:underline font-medium">Lokasi Pulang</span>
                        </a>
                    )}
                    {item.notes && <div className="text-[10px] italic text-gray-400 mt-1 line-clamp-2">&ldquo;{item.notes}&rdquo;</div>}
                </div>
            )
        },
        {
            key: 'status',
            header: 'Status',
            priority: 'primary',
            render: (item) => {
                const statusConfig: Record<string, { bg: string, text: string, label: string }> = {
                    'ON_TIME': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400', label: 'Tepat Waktu' },
                    'LATE': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400', label: 'Terlambat' },
                    'SICK': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-400', label: 'Sakit' },
                    'PERMIT': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-400', label: 'Izin' },
                    'ALPHA': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-400', label: 'Mangkir' },
                    'ABSENT': { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-800 dark:text-gray-400', label: 'Absen' },
                    'DAY_OFF': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-400', label: 'Libur' }
                }
                const config = statusConfig[item.status] || statusConfig['ABSENT'] || { bg: 'bg-gray-100', text: 'text-gray-800', label: item.status };
                
                return (
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${config.bg} ${config.text}`}>
                        {config.label}
                    </span>
                )
            }
        },
        {
            key: 'foto',
            header: 'Foto',
            priority: 'secondary',
            render: (item) => (
                <div className="flex gap-2">
                    {item.checkInPhoto && (
                        <button onClick={() => setSelectedPhoto(item.checkInPhoto)} className="relative group">
                            <div className="w-8 h-8 rounded bg-gray-200 overflow-hidden ring-1 ring-gray-300 dark:ring-gray-600 hover:ring-blue-500 transition-all">
                                <Image src={item.checkInPhoto} alt="In" fill className="object-cover" />
                            </div>
                        </button>
                    )}
                    {item.checkOutPhoto && (
                        <button onClick={() => setSelectedPhoto(item.checkOutPhoto)} className="relative group">
                            <div className="w-8 h-8 rounded bg-gray-200 overflow-hidden ring-1 ring-gray-300 dark:ring-gray-600 hover:ring-orange-500 transition-all">
                                <Image src={item.checkOutPhoto} alt="Out" fill className="object-cover" />
                            </div>
                        </button>
                    )}
                </div>
            )
        }
    ]

    // Render actions for each row
    const renderActions = (item: Attendance) => (
        <>
            {canUpdate && (
                <button
                    onClick={() => handleEditClick(item)}
                    className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 p-2 rounded-full transition-colors dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400"
                    title="Edit Data"
                >
                    <MdEdit size={18} />
                </button>
            )}
            {canDelete && (
                <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-2 rounded-full transition-colors dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400"
                    title="Hapus Data"
                >
                    <MdDelete size={18} />
                </button>
            )}
        </>
    )

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Data Absensi</h1>

            {/* Rate Limit Warning */}
            {retryCountdown !== null && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3 dark:bg-yellow-900/20 dark:border-yellow-800">
                    <MdTimer className="text-yellow-600 text-xl" />
                    <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">Terlalu Banyak Permintaan</p>
                        <p className="text-sm text-yellow-600 dark:text-yellow-400">
                            Coba lagi dalam {retryCountdown} detik...
                        </p>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* On Time Card */}
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500 dark:bg-gray-800">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Tepat Waktu</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary['ON_TIME'] || 0}</div>
                </div>

                {/* Late Card */}
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500 dark:bg-gray-800">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Terlambat</div>
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{summary['LATE'] || 0}</div>
                </div>

                {/* Monthly Total Card */}
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500 dark:bg-gray-800">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Total Absen Bulan Ini</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalItems}</div>
                    <div className="text-xs text-gray-400 mt-1">
                        {formatDateDisplay(startDate)} - {formatDateDisplay(endDate)}
                    </div>
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
                <div className="flex gap-2">
                    <button
                        onClick={() => fetchAttendances()}
                        disabled={retryCountdown !== null}
                        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm h-[38px] flex items-center gap-2 disabled:opacity-50"
                    >
                        <FaSearch /> Cari
                    </button>
                    <button
                        onClick={handleExport}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm h-[38px] flex items-center gap-2"
                    >
                        <FaFileExport /> Export CSV
                    </button>
                </div>
            </div>

            {/* Responsive Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden dark:bg-gray-800">
                <ResponsiveTable
                    data={attendances}
                    columns={columns}
                    keyField="id"
                    loading={loading}
                    emptyMessage="Tidak ada data ditemukan"
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

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Data Absensi</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                <MdCancel size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Masuk (Check In)</label>
                                <input
                                    type="datetime-local"
                                    value={editForm.checkIn}
                                    onChange={(e) => {
                                        setEditForm({ ...editForm, checkIn: e.target.value })
                                        if (editErrors.checkIn) setEditErrors({ ...editErrors, checkIn: '' })
                                    }}
                                    className={`w-full border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white ${editErrors.checkIn ? 'border-red-500' : ''}`}
                                />
                                {editErrors.checkIn && <p className="text-xs text-red-500 mt-1">{editErrors.checkIn}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Pulang (Check Out)</label>
                                <input
                                    type="datetime-local"
                                    value={editForm.checkOut}
                                    onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })}
                                    className="w-full border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                                <p className="text-xs text-gray-500 mt-1">Biarkan kosong jika belum checkout</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                                <select
                                    value={editForm.status}
                                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                    className="w-full border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    <option value="ON_TIME">Tepat Waktu (ON_TIME)</option>
                                    <option value="LATE">Terlambat (LATE)</option>
                                    <option value="SICK">Sakit (SICK)</option>
                                    <option value="PERMIT">Izin (PERMIT)</option>
                                    <option value="ABSENT">Alpha (ABSENT)</option>
                                    <option value="DAY_OFF">Libur (DAY_OFF)</option>
                                </select>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end gap-2">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="px-4 py-2 border rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleUpdate}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center gap-2"
                            >
                                <MdSave /> Simpan Perubahan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

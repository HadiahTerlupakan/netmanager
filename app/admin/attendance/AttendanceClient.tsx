'use client'

import { useState, useEffect, useCallback } from 'react'
import { FaSearch, FaFileExport, FaBuilding } from 'react-icons/fa'
import { MdDelete, MdLocationOn, MdEdit, MdSave, MdTimer } from 'react-icons/md'
import Image from 'next/image'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
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
        workingHourMode?: string
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
        const d = new Date()
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        return `${year}-${month}-01`
    })
    const [endDate, setEndDate] = useState(() => {
        const d = new Date()
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    })
    const [siteId, setSiteId] = useState('')
    const [departmentId, setDepartmentId] = useState('')
    const [searchQuery, setSearchQuery] = useState('')

    // Debounced filters
    const debouncedStartDate = useDebounce(startDate, 300)
    const debouncedEndDate = useDebounce(endDate, 300)
    const debouncedSiteId = useDebounce(siteId, 300)
    const debouncedDepartmentId = useDebounce(departmentId, 300)
    const debouncedSearchQuery = useDebounce(searchQuery, 300)

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

    const fetchAttendances = useCallback(async (signal?: AbortSignal) => {
        if (retryCountdown !== null) return

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
            if (debouncedSearchQuery) params.search = debouncedSearchQuery

            const query = new URLSearchParams(params)
            const response = await fetchWithHandling<Attendance[]>(`/api/admin/attendance?${query.toString()}`, { signal })

            setAttendances(response.data || [])
            setTotalPages(response.pagination?.totalPages || 1)
            setTotalItems(response.pagination?.total || 0)
            if (response.summary) setSummary(response.summary)
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') return
            if (isFetchError(error)) {
                if (error.retryAfter) {
                    setRetryCountdown(error.retryAfter)
                }
                showToast('error', formatErrorMessage(error))
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false)
            }
        }
    }, [page, debouncedStartDate, debouncedEndDate, debouncedSiteId, debouncedDepartmentId, debouncedSearchQuery, retryCountdown, showToast])

    useEffect(() => {
        fetchOptions()
    }, [fetchOptions])

    useEffect(() => {
        const controller = new AbortController()
        fetchAttendances(controller.signal)
        return () => controller.abort()
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
        if (searchQuery) params.search = searchQuery

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
                            alt="" fill sizes="40px" className="rounded-full object-cover"
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
                if (item.status === 'SICK') return <div className="text-sm text-orange-500 italic font-medium">Sakit</div>
                if (item.status === 'PERMIT') return <div className="text-sm text-blue-500 italic font-medium">Izin</div>
                if (item.status === 'DAY_OFF') return <div className="text-sm text-purple-500 italic font-medium">Libur</div>
                const checkInDate = new Date(item.checkIn);
                const isDummyCheckIn = checkInDate.getHours() === 0 && checkInDate.getMinutes() === 0 && checkInDate.getSeconds() === 0;
                const isSystemGenerated = item.notes?.includes('Tanpa Keterangan') || item.notes?.includes('System');
                
                if (['ALPHA', 'ABSENT'].includes(item.status)) {
                    if (isSystemGenerated || (isDummyCheckIn && !item.checkOut)) {
                        return <div className="text-sm text-red-500 italic font-medium">Mangkir</div>
                    }
                }
                
                const now = new Date();
                const isToday = checkInDate.toDateString() === now.toDateString();
                
                // Forgot Check-out logic
                const isForgotCheckOut = (item.status === 'ALPHA' || item.status === 'ABSENT') && (!item.checkOut && !isToday) && !isDummyCheckIn;

                const checkInHour = checkInDate.getHours();
                const checkInMinute = checkInDate.getMinutes();
                const isOnTime = checkInHour < 8 || (checkInHour === 8 && checkInMinute === 0);

                return (
                    <div>
                        {isDummyCheckIn ? (
                            <div className="text-sm text-red-500 font-mono bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded inline-block mb-1">
                                IN: -
                            </div>
                        ) : (
                            <div className="text-sm text-green-600 font-mono bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded inline-block mb-1">
                                IN: {formatTimeDisplay(item.checkIn)}
                            </div>
                        )}
                        {item.status === 'NO_CHECKOUT' ? (
                            <div className={`text-[10px] italic font-medium block mt-1 ${isOnTime ? 'text-green-600' : 'text-yellow-600'}`}>
                                {isOnTime ? 'Tepat Waktu' : 'Terlambat'} &nbsp;(Tidak Checkout)
                            </div>
                        ) : isForgotCheckOut ? (
                            <div className={`text-[10px] italic font-medium block mt-1 ${isOnTime ? 'text-green-600' : 'text-yellow-600'}`}>
                                {isOnTime ? 'Tepat Waktu' : 'Terlambat'} dan tidak cekout
                            </div>
                        ) : (
                            item.checkOut && (
                                <div className="text-sm text-red-600 font-mono bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded inline-block">
                                    OUT: {formatTimeDisplay(item.checkOut)}
                                </div>
                            )
                        )}
                        {!item.checkOut && !isForgotCheckOut && (
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
                const checkInDate = new Date(item.checkIn);
                const isDummyCheckIn = checkInDate.getHours() === 0 && checkInDate.getMinutes() === 0 && checkInDate.getSeconds() === 0;
                const now = new Date();
                const isToday = checkInDate.toDateString() === now.toDateString();
                
                const isSystemGenerated = item.notes?.includes('Tanpa Keterangan') || item.notes?.includes('System');
                const isForgotCheckOut = (item.status === 'ALPHA' || item.status === 'ABSENT') && (!item.checkOut && !isToday) && !isDummyCheckIn;

                if (!item.checkOut || ['ALPHA', 'ABSENT', 'SICK', 'PERMIT', 'DAY_OFF', 'NO_CHECKOUT'].includes(item.status) || isSystemGenerated || isForgotCheckOut || isDummyCheckIn) {
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
            render: (item) => {
                if (['SICK', 'PERMIT', 'DAY_OFF'].includes(item.status)) return <span className="text-xs text-gray-400">-</span>

                const checkInDate = new Date(item.checkIn);
                const isDummyCheckIn = checkInDate.getHours() === 0 && checkInDate.getMinutes() === 0 && checkInDate.getSeconds() === 0;
                const isSystemGenerated = item.notes?.includes('Tanpa Keterangan') || item.notes?.includes('System');
                
                if (isSystemGenerated || isDummyCheckIn) return <span className="text-xs text-gray-400">-</span>

                const now = new Date();
                const isToday = checkInDate.toDateString() === now.toDateString();
                const isForgotCheckOut = (item.status === 'ALPHA' || item.status === 'ABSENT') && (!item.checkOut && !isToday) && !isDummyCheckIn;

                return (
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
                        
                        {(item.checkOutLocation && !isForgotCheckOut) ? (
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
                        ) : (
                            isForgotCheckOut && <div className="text-[10px] text-red-400 italic">tidak cekout</div>
                        )}
                    </div>
                )
            }
        },
        {
            key: 'status',
            header: 'Status',
            priority: 'primary',
            render: (item) => {
                const checkInDate = new Date(item.checkIn);
                const isDummyCheckIn = checkInDate.getHours() === 0 && checkInDate.getMinutes() === 0 && checkInDate.getSeconds() === 0;
                const now = new Date();
                const isToday = checkInDate.toDateString() === now.toDateString();
                
                const isSystemGenerated = item.notes?.includes('Tanpa Keterangan') || item.notes?.includes('System');
                const isForgotCheckOut = (item.status === 'ALPHA' || item.status === 'ABSENT') && (!item.checkOut && !isToday) && !isSystemGenerated && !isDummyCheckIn;

                const statusConfig: Record<string, { bg: string, text: string, label: string }> = {
                    'ON_TIME': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400', label: 'Tepat Waktu' },
                    'LATE': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400', label: 'Terlambat' },
                    'SICK': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-400', label: 'Sakit' },
                    'PERMIT': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-400', label: 'Izin' },
                    'ALPHA': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-400', label: 'Mangkir' },
                    'ABSENT': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-400', label: 'Mangkir' },
                    'DAY_OFF': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-400', label: 'Libur/Tukar Libur' },
                    'NO_CHECKOUT': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400', label: 'Tidak Checkout' }
                }
                
                let config = statusConfig[item.status] || statusConfig['ABSENT'];
                
                if (isForgotCheckOut) {
                    const checkInHour = checkInDate.getHours();
                    const checkInMinute = checkInDate.getMinutes();
                    const isFlexible = item.user?.workingHourMode === 'FLEXIBLE';
                    const wasOnTime = isFlexible || checkInHour < 8 || (checkInHour === 8 && checkInMinute === 0);
                    
                    if (wasOnTime) {
                        config = { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400', label: 'Tepat Waktu dan tidak cekout' };
                    } else {
                        config = { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400', label: 'Terlambat dan tidak cekout' };
                    }
                } else if (!item.checkOut && isToday && !isSystemGenerated && !['SICK', 'PERMIT', 'DAY_OFF'].includes(item.status) && !isDummyCheckIn && item.status !== 'NO_CHECKOUT') {
                     config = { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-300', label: 'Belum Checkout' };
                } else if ((isSystemGenerated || isDummyCheckIn) && (item.status === 'ALPHA' || item.status === 'ABSENT' || item.status === 'NO_CHECKOUT')) {
                    if (isDummyCheckIn && item.checkOut) {
                        config = { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-400', label: 'Lupa Check-in (Mangkir)' };
                    } else {
                        config = { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-400', label: 'Mangkir' };
                    }
                }

                return (
                    <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap gap-1 items-center">
                            <span className={`px-2 inline-flex text-[10px] leading-5 font-semibold rounded-full ${config.bg} ${config.text}`}>
                                {config.label}
                            </span>
                        </div>
                        {item.notes && (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 italic line-clamp-2 max-w-[150px]" title={item.notes}>
                                &ldquo;{item.notes}&rdquo;
                            </div>
                        )}
                    </div>
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
                        <button onClick={() => setSelectedPhoto(item.checkInPhoto)} className="group">
                            <div className="w-8 h-8 rounded bg-gray-200 overflow-hidden ring-1 ring-gray-300 dark:ring-gray-600 hover:ring-blue-500 transition-all relative">
                                <Image src={item.checkInPhoto} alt="In" fill sizes="32px" className="object-cover" />
                            </div>
                        </button>
                    )}
                    {item.checkOutPhoto && (
                        <button onClick={() => setSelectedPhoto(item.checkOutPhoto)} className="group">
                            <div className="w-8 h-8 rounded bg-gray-200 overflow-hidden ring-1 ring-gray-300 dark:ring-gray-600 hover:ring-orange-500 transition-all relative">
                                <Image src={item.checkOutPhoto} alt="Out" fill sizes="32px" className="object-cover" />
                            </div>
                        </button>
                    )}
                </div>
            )
        }
    ]

    const renderActions = (item: Attendance) => (
        <>
            {canUpdate && (
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleEditClick(item)}
                    className="text-blue-600 dark:text-blue-400"
                    title="Edit Data"
                >
                    <MdEdit size={18} />
                </Button>
            )}
            {canDelete && (
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(item.id)}
                    className="text-red-600 dark:text-red-400"
                    title="Hapus Data"
                >
                    <MdDelete size={18} />
                </Button>
            )}
        </>
    )

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Data Absensi</h1>

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500 dark:bg-gray-800">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Tepat Waktu</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary['ON_TIME'] || 0}</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500 dark:bg-gray-800">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Terlambat</div>
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{summary['LATE'] || 0}</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500 dark:bg-gray-800">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Total Absen Bulan Ini</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalItems}</div>
                    <div className="text-xs text-gray-400 mt-1">
                        {formatDateDisplay(startDate)} - {formatDateDisplay(endDate)}
                    </div>
                </div>
            </div>

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
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Pencarian Karyawan</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FaSearch className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Cari nama atau email..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                            className="border rounded pl-10 pr-3 py-2 text-sm w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
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
                    <Button onClick={() => fetchAttendances()}
                        disabled={retryCountdown !== null}
                    >
                        <FaSearch /> Cari
                    </Button>
                    <Button
                        variant="success"
                        onClick={handleExport}
                    >
                        <FaFileExport /> Export CSV
                    </Button>
                    {hasPermission('attendance:create') && (
                        <Button
                            variant="default"
                            onClick={async () => {
                                if (!confirm('Jalankan proses perbaikan (backfill) presensi Mangkir otomatis?')) return;
                                try {
                                    await fetchWithHandling('/api/admin/attendance/backdate', {
                                        method: 'POST',
                                        body: JSON.stringify({ startDate, endDate })
                                    })
                                    showToast('success', 'Backfill presensi berhasil dijalankan!')
                                    fetchAttendances()
                                } catch (error) {
                                     console.error(error);
                                     showToast('error', 'Gagal menjalankan backfill absen')
                                }
                            }}
                        >
                            Sync Mangkir
                        </Button>
                    )}
                </div>
            </div>

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

                <div className="px-6 py-3 flex flex-col sm:flex-row justify-between items-center border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                    >
                        Sebelumnya
                    </Button>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Halaman {page} dari {totalPages} ({totalItems} Data)</span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                    >
                        Selanjutnya
                    </Button>
                </div>
            </div>

            <Modal
                isOpen={!!selectedPhoto}
                onClose={() => setSelectedPhoto(null)}
                title="Lihat Foto"
                size="2xl"
            >
                <div className="relative w-full aspect-square md:aspect-video bg-black/5 rounded-lg overflow-hidden">
                    {selectedPhoto && (
                        <Image
                            src={selectedPhoto}
                            alt="Full view"
                            fill
                            sizes="(max-width: 768px) 100vw, 800px"
                            className="object-contain"
                        />
                    )}
                </div>
                <ModalFooter>
                    <Button
                        variant="secondary"
                        onClick={() => setSelectedPhoto(null)}
                    >
                        Tutup
                    </Button>
                </ModalFooter>
            </Modal>

            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit Data Absensi"
            >
                <div className="space-y-4">
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
                            <option value="NO_CHECKOUT">Tidak Checkout (NO_CHECKOUT)</option>
                            <option value="DAY_OFF">Libur (DAY_OFF)</option>
                        </select>
                    </div>
                </div>
                <ModalFooter>
                    <Button
                        variant="outline"
                        onClick={() => setIsEditModalOpen(false)}
                    >
                        Batal
                    </Button>
                    <Button onClick={handleUpdate}
                    >
                        <MdSave /> Simpan Perubahan
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    )
}

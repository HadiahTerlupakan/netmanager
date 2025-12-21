'use client'

import { useState, useEffect, useCallback } from 'react'
import { FaSearch, FaCalendarAlt, FaFileExport, FaUser, FaBuilding } from 'react-icons/fa'
import { MdDelete, MdCancel, MdLocationOn } from 'react-icons/md'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

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
        department: {
            name: string
        } | null
        site?: {
            name: string
        } | null
    }
}

export function AttendanceClient() {
    const [attendances, setAttendances] = useState<Attendance[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalItems, setTotalItems] = useState(0)

    // Options
    const [sites, setSites] = useState<{ id: string, name: string }[]>([])
    const [departments, setDepartments] = useState<{ id: string, name: string }[]>([])

    // Filters
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [siteId, setSiteId] = useState('')
    const [departmentId, setDepartmentId] = useState('')

    // Summary
    const [summary, setSummary] = useState<Record<string, number>>({})

    const fetchOptions = async () => {
        try {
            const res = await fetch('/api/admin/options')
            if (res.ok) {
                const data = await res.json()
                setSites(data.sites)
                setDepartments(data.departments)
            }
        } catch (error) {
            console.error('Failed to fetch options', error)
        }
    }

    const fetchAttendances = useCallback(async () => {
        setLoading(true)
        try {
            const query = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                startDate,
                endDate,
                ...(siteId && { siteId }),
                ...(departmentId && { departmentId })
            })

            const res = await fetch(`/api/admin/attendance?${query.toString()}`)
            const data = await res.json()

            if (data.success) {
                setAttendances(data.data)
                setTotalPages(data.pagination.totalPages)
                setTotalItems(data.pagination.total)
                if (data.summary) setSummary(data.summary)
            } else {
                toast.error('Gagal memuat data absensi')
            }
        } catch (error) {
            console.error('Error fetching attendance:', error)
            toast.error('Terjadi kesalahan saat memuat data')
        } finally {
            setLoading(false)
        }
    }, [page, startDate, endDate])

    useEffect(() => {
        fetchAttendances()
    }, [fetchAttendances])

    const handleDelete = async (id: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus data absensi ini?')) return

        try {
            const res = await fetch(`/api/admin/attendance/${id}`, {
                method: 'DELETE'
            })
            const data = await res.json()

            if (data.success) {
                toast.success('Data absensi berhasil dihapus')
                fetchAttendances()
            } else {
                toast.error(data.error || 'Gagal menghapus data')
            }
        } catch (error) {
            console.error('Delete error:', error)
            toast.error('Terjadi kesalahan')
        }
    }

    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Data Absensi</h1>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {Object.entries(summary).map(([status, count]) => (
                    <div key={status} className="bg-white p-4 rounded-lg shadow border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                        <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">{status.toLowerCase().replace('_', ' ')}</div>
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
                <button
                    onClick={() => fetchAttendances()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm h-[38px] flex items-center gap-2"
                >
                    <FaSearch /> Cari
                </button>
            </div>

            {/* Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden dark:bg-gray-800">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Karyawan</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site / Dept</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jam Kerja</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lokasi</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Foto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                            {loading ? (
                                <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-500">Memuat data...</td></tr>
                            ) : attendances.length === 0 ? (
                                <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-500">Tidak ada data ditemukan</td></tr>
                            ) : (
                                attendances.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-10 w-10 flex-shrink-0 relative">
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
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{item.user.site?.name || '-'}</div>
                                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                                <FaBuilding className="text-[10px]" /> {item.user.department?.name || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {format(new Date(item.checkIn), 'dd MMM yyyy', { locale: id })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-green-600 font-mono bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded inline-block mb-1">
                                                IN: {format(new Date(item.checkIn), 'HH:mm', { locale: id })}
                                            </div>
                                            {item.checkOut ? (
                                                <div className="text-sm text-red-600 font-mono bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded inline-block">
                                                    OUT: {format(new Date(item.checkOut), 'HH:mm', { locale: id })}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-gray-400 italic mt-1">Belum checkout</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                            <div className="flex flex-col gap-1 max-w-[200px]">
                                                {/* Check In */}
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

                                                {/* Check Out */}
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

                                                {item.notes && <div className="text-[10px] italic text-gray-400 mt-1 line-clamp-2">"{item.notes}"</div>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.status === 'LATE' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                item.status === 'SICK' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                                    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
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
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-2 rounded-full transition-colors dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400"
                                                title="Hapus Data"
                                            >
                                                <MdDelete size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-6 py-3 flex justify-between items-center border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setSelectedPhoto(null)}>
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

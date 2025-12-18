'use client'

import { useState, useEffect, useCallback } from 'react'
import { FaSearch, FaCalendarAlt, FaFileExport, FaUser, FaBuilding } from 'react-icons/fa'
import { MdDelete } from 'react-icons/md'
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
    }
}

export default function AdminAttendancePage() {
    const [attendances, setAttendances] = useState<Attendance[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)

    // Filters
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

    const fetchAttendances = useCallback(async () => {
        setLoading(true)
        try {
            const query = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                startDate,
                endDate
            })

            const res = await fetch(`/api/admin/attendance?${query.toString()}`)
            const data = await res.json()

            if (data.success) {
                setAttendances(data.data)
                setTotalPages(data.pagination.totalPages)
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
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Data Absensi</h1>
                    <p className="text-gray-500 dark:text-gray-400">Monitoring kehadiran karyawan</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Mulai</label>
                    <div className="relative">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="pl-10 pr-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
                        />
                        <FaCalendarAlt className="absolute left-3 top-3 text-gray-400" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Selesai</label>
                    <div className="relative">
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="pl-10 pr-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white w-full"
                        />
                        <FaCalendarAlt className="absolute left-3 top-3 text-gray-400" />
                    </div>
                </div>
                <div>
                    <button
                        onClick={() => fetchAttendances()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 h-[42px]"
                    >
                        <FaSearch /> Filter
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Karyawan</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Check In</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Check Out</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lokasi & Catatan</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Foto</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                        <div className="flex justify-center items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                            Memuat data...
                                        </div>
                                    </td>
                                </tr>
                            ) : attendances.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                        Tidak ada data absensi pada periode ini.
                                    </td>
                                </tr>
                            ) : (
                                attendances.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs relative overflow-hidden">
                                                    {item.user.image ? (
                                                        <Image src={item.user.image} alt={item.user.name || ''} fill className="object-cover" />
                                                    ) : (
                                                        (item.user.name?.charAt(0) || 'U').toUpperCase()
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white text-sm">{item.user.name}</p>
                                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                                        <FaBuilding className="text-[10px]" />
                                                        {item.user.department?.name || 'No Dept'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                            {format(new Date(item.checkIn), 'dd MMM yyyy', { locale: id })}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="font-mono text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                                                {format(new Date(item.checkIn), 'HH:mm', { locale: id })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {item.checkOut ? (
                                                <span className="font-mono text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded">
                                                    {format(new Date(item.checkOut), 'HH:mm', { locale: id })}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <div className="flex flex-col gap-1">
                                                {item.location && (
                                                    <a
                                                        href={`https://www.google.com/maps?q=${item.location}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 hover:underline"
                                                        title={`Masuk: ${item.location}`}
                                                    >
                                                        <FaSearch className="text-[10px]" /> Masuk (Peta)
                                                    </a>
                                                )}
                                                {item.checkOutLocation && (
                                                    <a
                                                        href={`https://www.google.com/maps?q=${item.checkOutLocation}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700 hover:underline"
                                                        title={`Keluar: ${item.checkOutLocation}`}
                                                    >
                                                        <FaSearch className="text-[10px]" /> Keluar (Peta)
                                                    </a>
                                                )}
                                                {item.notes && (
                                                    <p className="text-gray-500 text-xs italic max-w-[150px] truncate" title={item.notes}>
                                                        "{item.notes}"
                                                    </p>
                                                )}
                                                {!item.location && !item.checkOutLocation && !item.notes && <span className="text-gray-400">-</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                {item.checkInPhoto && (
                                                    <button onClick={() => setSelectedPhoto(item.checkInPhoto)}>
                                                        <div className="w-8 h-8 rounded bg-gray-200 relative overflow-hidden hover:ring-2 ring-blue-500 transition">
                                                            <Image src={item.checkInPhoto} alt="In" fill className="object-cover" />
                                                        </div>
                                                    </button>
                                                )}
                                                {item.checkOutPhoto && (
                                                    <button onClick={() => setSelectedPhoto(item.checkOutPhoto)}>
                                                        <div className="w-8 h-8 rounded bg-gray-200 relative overflow-hidden hover:ring-2 ring-orange-500 transition">
                                                            <Image src={item.checkOutPhoto} alt="Out" fill className="object-cover" />
                                                        </div>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition"
                                                title="Batal/Hapus"
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

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>

            {/* Photo Modal */}
            {
                selectedPhoto && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setSelectedPhoto(null)}>
                        <div className="relative max-w-3xl max-h-[90vh] w-full h-full">
                            <Image src={selectedPhoto} alt="Full view" fill className="object-contain" />
                            <button
                                className="absolute top-4 right-4 text-white hover:text-gray-300"
                                onClick={() => setSelectedPhoto(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    )
}

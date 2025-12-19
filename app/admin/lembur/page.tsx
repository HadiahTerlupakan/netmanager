'use client'

import { useEffect, useState } from 'react'
import { MdCheckCircle, MdCancel, MdPending, MdAccessTime, MdTimer, MdDoneAll, MdPlayArrow, MdLocationOn, MdDelete } from 'react-icons/md'
import Image from 'next/image'

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
    user: {
        name: string
        email: string
        image?: string
        site?: {
            name: string
        }
    }
}

export default function AdminOvertimePage() {
    const [requests, setRequests] = useState<Overtime[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [rejectId, setRejectId] = useState<string | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

    useEffect(() => {
        fetchRequests()
    }, [])

    const fetchRequests = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/admin/lembur')
            if (res.ok) {
                const data = await res.json()
                setRequests(data)
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action, reason })
            })

            if (res.ok) {
                await fetchRequests()
                if (action === 'reject') {
                    setRejectId(null)
                    setRejectReason('')
                }
            } else {
                alert('Gagal memproses permintaan')
            }
        } catch (error) {
            console.error('Action failed:', error)
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
                        <MdCheckCircle /> Disetujui (Menunggu Pelaksanaan)
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
                        <MdPending /> Menunggu Approval
                    </span>
                )
        }
    }

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Memuat data...</div>
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Lembur</h1>
            </div>

            <div className="bg-white dark:bg-[#1c2936] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Karyawan</th>
                                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Site</th>
                                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Tanggal Pengajuan</th>
                                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Alasan</th>
                                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Mulai Lembur</th>
                                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Selesai Lembur</th>
                                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Status</th>
                                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {requests.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        Tidak ada data pengajuan lembur
                                    </td>
                                </tr>
                            ) : (
                                requests.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        {/* Karyawan */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                                    {item.user.image ? (
                                                        <img src={item.user.image} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                    ) : (
                                                        <span className="font-bold text-xs">{item.user.name?.charAt(0) || 'U'}</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{item.user.name}</p>
                                                    <p className="text-xs text-gray-500 truncate">{item.user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {/* Site */}
                                        <td className="px-4 py-3">
                                            {item.user.site?.name ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                                    {item.user.site.name}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">-</span>
                                            )}
                                        </td>
                                        {/* Tanggal Pengajuan */}
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                            <div className="text-sm font-medium">
                                                {new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(item.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        {/* Alasan */}
                                        <td className="px-4 py-3">
                                            <p className="text-gray-600 dark:text-gray-300 text-sm max-w-[150px] truncate" title={item.reason}>
                                                {item.reason}
                                            </p>
                                            {item.rejectionReason && (
                                                <p className="text-xs text-red-500 mt-1 italic truncate" title={item.rejectionReason}>
                                                    Note: {item.rejectionReason}
                                                </p>
                                            )}
                                        </td>
                                        {/* Mulai Lembur */}
                                        <td className="px-4 py-3">
                                            {item.startTime ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                                        {new Date(item.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        {item.startPhoto && (
                                                            <button onClick={() => setSelectedPhoto(item.startPhoto!)} title="Lihat Foto Mulai">
                                                                <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 relative overflow-hidden hover:ring-2 ring-blue-500 transition">
                                                                    <Image src={item.startPhoto} alt="Start" fill className="object-cover" />
                                                                </div>
                                                            </button>
                                                        )}
                                                        {item.startLocation && (
                                                            <a href={`https://www.google.com/maps?q=${item.startLocation}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 p-1" title="Lihat Lokasi">
                                                                <MdLocationOn className="text-lg" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">Belum mulai</span>
                                            )}
                                        </td>
                                        {/* Selesai Lembur */}
                                        <td className="px-4 py-3">
                                            {item.endTime ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                                                        {new Date(item.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        {item.endPhoto && (
                                                            <button onClick={() => setSelectedPhoto(item.endPhoto!)} title="Lihat Foto Selesai">
                                                                <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 relative overflow-hidden hover:ring-2 ring-green-500 transition">
                                                                    <Image src={item.endPhoto} alt="End" fill className="object-cover" />
                                                                </div>
                                                            </button>
                                                        )}
                                                        {item.endLocation && (
                                                            <a href={`https://www.google.com/maps?q=${item.endLocation}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-800 p-1" title="Lihat Lokasi">
                                                                <MdLocationOn className="text-lg" />
                                                            </a>
                                                        )}
                                                    </div>
                                                    {item.duration != null && (
                                                        <span className="text-xs font-bold text-purple-500">
                                                            Total: {item.duration} Menit
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">Belum selesai</span>
                                            )}
                                        </td>
                                        {/* Status */}
                                        <td className="px-4 py-3">
                                            {getStatusBadge(item.status)}
                                        </td>
                                        {/* Aksi */}
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1">
                                                {item.status === 'PENDING' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleAction(item.id, 'approve')}
                                                            disabled={processingId === item.id}
                                                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                                            title="Setujui"
                                                        >
                                                            <MdCheckCircle className="text-lg" />
                                                        </button>
                                                        <button
                                                            onClick={() => setRejectId(item.id)}
                                                            disabled={processingId === item.id}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                            title="Tolak"
                                                        >
                                                            <MdCancel className="text-lg" />
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    disabled={processingId === item.id}
                                                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Hapus"
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
            </div >

            {/* Reject Modal */}
            {
                rejectId && (
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
                )
            }

            {/* Photo Modal */}
            {selectedPhoto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setSelectedPhoto(null)}>
                    <div className="relative max-w-3xl max-h-[90vh] w-full h-full">
                        <Image src={selectedPhoto} alt="Full view" fill className="object-contain" />
                        <button
                            className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black/50 px-3 py-1 rounded-lg"
                            onClick={() => setSelectedPhoto(null)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div >
    )
}

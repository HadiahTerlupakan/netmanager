"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { HiOutlineEye, HiOutlineLockClosed, HiOutlineMagnifyingGlass, HiOutlinePencilSquare, HiOutlinePlus, HiOutlineTrash, HiOutlineArrowUturnLeft, HiOutlineGift, HiOutlineCheck, HiOutlineXMark } from 'react-icons/hi2'
import { Button, buttonVariants } from '@/components/ui/Button'
import { StatusBadge } from '@/components/common/StatusBadge'
import PageLoader from '@/components/ui/PageLoader'
import ResponsiveTable from '@/components/ui/ResponsiveTable'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { toast } from 'react-hot-toast'
import { usePermission } from '@/hooks/use-permission'
import axios from 'axios'
import Image from 'next/image'
import { SiteFilter } from '@/components/common/SiteFilter'

interface PointClaim {
    id: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    buktiUrls: string[]
    keterangan?: string
    pointValue: number
    reviewNotes?: string
    createdAt: string
}

interface CanvasingItem {
    id: string
    nama: string
    paket: string
    alamat: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    sales?: { name: string } | null
    user?: { name: string; email: string } | null
    createdAt: string
    pointClaims?: PointClaim
}

export default function CanvasingList() {
    const [items, setItems] = useState<CanvasingItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [siteId, setSiteId] = useState<string | undefined>(undefined)
    const [page, setPage] = useState(1)
    const [limit] = useState(10)
    const [totalPages, setTotalPages] = useState(1)
    const [claimModal, setClaimModal] = useState<{ open: boolean; item: CanvasingItem | null; processing: boolean }>({
        open: false,
        item: null,
        processing: false
    })
    const [zoomImage, setZoomImage] = useState<string | null>(null)

    // Permission checks
    const { hasPermission, isLoading: permLoading, isSuperAdmin } = usePermission()
    const canRead = isSuperAdmin || hasPermission('canvasing:read')
    const canCreate = isSuperAdmin || hasPermission('canvasing:create')
    const canUpdate = isSuperAdmin || hasPermission('canvasing:update')
    const canDelete = isSuperAdmin || hasPermission('canvasing:delete')

    const fetchData = useCallback(async () => {
        try {
            const params = new URLSearchParams()
            if (siteId) params.append('siteId', siteId)
            params.append('page', page.toString())
            params.append('limit', limit.toString())

            const res = await fetch(`/api/marketing/canvasing?${params.toString()}`)
            if (res.ok) {
                const json = await res.json()
                setItems(json.data || [])
                setTotalPages(Math.ceil((json.total || 0) / limit))
            } else {
                const json = await res.json().catch((): null => null)
                toast.error(json?.error || 'Gagal memuat data canvasing')
            }
        } catch (error) {
            console.error('Failed to fetch canvasing', error)
            toast.error('Gagal menghubungi server, coba lagi nanti')
        } finally {
            setLoading(false)
        }
    }, [siteId, page, limit])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleApproveClaim = async (claimId: string) => {
        setClaimModal(prev => ({ ...prev, processing: true }))
        try {
            await axios.put(`/api/marketing/point-claims/${claimId}`, {
                action: 'approve'
            })
            toast.success('Claim poin berhasil disetujui')
            setClaimModal({ open: false, item: null, processing: false })
            fetchData()
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.error || 'Gagal menyetujui claim')
            } else {
                toast.error('Gagal menyetujui claim')
            }
            setClaimModal(prev => ({ ...prev, processing: false }))
        }
    }

    const handleRejectClaim = async (claimId: string) => {
        const notes = prompt('Alasan penolakan:')
        if (!notes) {
            toast.error('Alasan penolakan harus diisi')
            return
        }

        setClaimModal(prev => ({ ...prev, processing: true }))
        try {
            await axios.put(`/api/marketing/point-claims/${claimId}`, {
                action: 'reject',
                notes
            })
            toast.success('Claim poin ditolak')
            setClaimModal({ open: false, item: null, processing: false })
            fetchData()
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.error || 'Gagal menolak claim')
            } else {
                toast.error('Gagal menolak claim')
            }
            setClaimModal(prev => ({ ...prev, processing: false }))
        }
    }

    const getPendingClaim = (item: CanvasingItem) => {
        return item.pointClaims?.status === 'PENDING' ? item.pointClaims : undefined
    }

    const getApprovedClaim = (item: CanvasingItem) => {
        return item.pointClaims?.status === 'APPROVED' ? item.pointClaims : undefined
    }
    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Hapus request canvasing atas nama ${name}?`)) return

        try {
            const res = await fetch(`/api/marketing/canvasing/${id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                toast.success('Data berhasil dihapus')
                fetchData()
            } else {
                const data = await res.json()
                toast.error(data.error || 'Gagal menghapus data')
            }
        } catch (error) {
            console.error('Delete error:', error)
            toast.error('Terjadi kesalahan saat menghapus data')
        }
    }

    const handleCancelApproval = async (id: string, name: string) => {
        if (!confirm(`Batalkan approval untuk ${name}? Status akan kembali ke PENDING dan WO terkait akan di-unlink.`)) return

        try {
            const res = await fetch(`/api/marketing/canvasing/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel_approval' })
            })
            if (res.ok) {
                toast.success('Approval dibatalkan, status kembali ke PENDING')
                fetchData()
            } else {
                const data = await res.json()
                toast.error(data.error || 'Gagal membatalkan approval')
            }
        } catch (error) {
            console.error('Cancel approval error:', error)
            toast.error('Terjadi kesalahan saat membatalkan approval')
        }
    }

    const filteredItems = items.filter(item =>
        item.nama.toLowerCase().includes(search.toLowerCase()) ||
        item.alamat.toLowerCase().includes(search.toLowerCase())
    )

    if (loading || permLoading) return <PageLoader />

    // Access denied view
    if (!canRead) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full mb-4">
                    <HiOutlineLockClosed className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Akses Terbatas</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                    Anda tidak memiliki izin untuk mengakses halaman Canvasing. Hubungi administrator untuk mendapatkan akses.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Daftar Canvasing</h1>
                    <p className="text-sm text-gray-500">Kelola dan verifikasi request instalasi dari lapangan</p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="w-full md:w-48">
                        <SiteFilter onSiteChange={setSiteId} />
                    </div>
                    {canCreate && (
                        <Link
                            href="/admin/marketing/canvasing/new"
                            className={`${buttonVariants({ variant: 'default', size: 'default' })} !text-white`}
                        >
                            <HiOutlinePlus className="w-5 h-5" />
                            Tambah Canvasing
                        </Link>
                    )}

                    <div className="relative w-full md:w-64">
                        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Cari nama atau alamat..."
                            className="pl-10 pr-4 py-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                <ResponsiveTable<CanvasingItem>
                    data={filteredItems}
                    loading={loading}
                    keyField="id"
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    columns={[
                        {
                            key: 'nama',
                            header: 'Calon Pelanggan',
                            priority: 'primary',
                            render: (item) => (
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-900 dark:text-white">{item.nama}</span>
                                    <span className="text-xs text-gray-500">{item.paket}</span>
                                </div>
                            )
                        },
                        {
                            key: 'sales',
                            header: 'Sales',
                            priority: 'secondary',
                            render: (item) => <span className="text-sm">{item.user?.name || item.sales?.name || '-'}</span>
                        },
                        {
                            key: 'alamat',
                            header: 'Alamat',
                            priority: 'secondary',
                            render: (item) => <span className="text-sm truncate max-w-[200px] block">{item.alamat}</span>
                        },
                        {
                            key: 'createdAt',
                            header: 'Tanggal',
                            priority: 'secondary',
                            render: (item) => (
                                <span className="text-xs">
                                    {format(new Date(item.createdAt), 'dd MMM yyyy', { locale: idLocale })}
                                </span>
                            )
                        },
                        {
                            key: 'status',
                            header: 'Status',
                            priority: 'primary',
                            render: (item) => <StatusBadge status={item.status} />
                        }
                    ]}
                    emptyMessage="Tidak ada data canvasing ditemukan."
                    renderActions={(item) => (
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/admin/marketing/canvasing/${item.id}`}
                                className="text-indigo-600 hover:text-indigo-800 p-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors inline-block"
                                title="Lihat Detail"
                            >
                                <HiOutlineEye className="w-5 h-5" />
                            </Link>

                            {item.status === 'PENDING' && canUpdate && (
                                <Link
                                    href={`/admin/marketing/canvasing/${item.id}/edit`}
                                    className="text-amber-600 hover:text-amber-800 p-2 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors inline-block"
                                    title="Edit"
                                >
                                    <HiOutlinePencilSquare className="w-5 h-5" />
                                </Link>
                            )}

                            {canDelete && (
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => handleDelete(item.id, item.nama)}
                                    title="Hapus"
                                >
                                    <HiOutlineTrash className="w-5 h-5" />
                                </Button>
                            )}

                            {item.status === 'APPROVED' && canUpdate && (
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => handleCancelApproval(item.id, item.nama)}
                                    title="Batal Approval"
                                >
                                    <HiOutlineArrowUturnLeft className="w-5 h-5" />
                                </Button>
                            )}

                            {/* Tombol Claim Poin */}
                            {getPendingClaim(item) && canUpdate && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setClaimModal({ open: true, item, processing: false })}
                                    title="Review Claim Poin"
                                    className="inline-flex items-center gap-1"
                                >
                                    <HiOutlineGift className="w-5 h-5" />
                                    <span className="hidden sm:inline">Claim</span>
                                </Button>
                            )}

                            {/* Badge Claimed */}
                            {getApprovedClaim(item) && (
                                <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg flex items-center gap-1">
                                    ⭐ Diklaim
                                </span>
                            )}
                        </div>
                    )}
                />
            </div>

            {/* Claim Modal */}
            {claimModal.open && claimModal.item && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                    <HiOutlineGift className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">Review Claim Poin</h3>
                                    <p className="text-xs text-gray-500">{claimModal.item.nama}</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setClaimModal({ open: false, item: null, processing: false })}
                            >
                                <HiOutlineXMark className="w-5 h-5 text-gray-500" />
                            </Button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4 overflow-y-auto max-h-[60vh]">
                            {(() => {
                                const claim = getPendingClaim(claimModal.item!)
                                if (!claim) return <p className="text-gray-500">Tidak ada claim pending</p>

                                return (
                                    <div className="space-y-4">
                                        {/* Claim Info */}
                                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
                                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                                <span className="text-lg">⭐</span>
                                                <span className="font-bold">+{claim.pointValue} Poin</span>
                                                <span className="text-xs text-amber-600 dark:text-amber-500 ml-auto">
                                                    {format(new Date(claim.createdAt), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Bukti Foto */}
                                        {claim.buktiUrls && claim.buktiUrls.length > 0 && (
                                            <div>
                                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Bukti Foto:</p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {claim.buktiUrls.map((url, idx) => (
                                                        <div key={idx} className="relative w-full aspect-square">
                                                            <Image
                                                                src={url}
                                                                alt={`Bukti ${idx + 1}`}
                                                                fill
                                                                className="rounded-lg object-cover cursor-zoom-in border border-gray-200 dark:border-gray-600 hover:opacity-80 transition-opacity"
                                                                onClick={() => setZoomImage(url)}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Keterangan */}
                                        {claim.keterangan && (
                                            <div>
                                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Keterangan:</p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                                                    {claim.keterangan}
                                                </p>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                            <button
                                                onClick={() => handleApproveClaim(claim.id)}
                                                disabled={claimModal.processing}
                                                className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <HiOutlineCheck className="w-5 h-5" />
                                                Setujui
                                            </button>
                                            <button
                                                onClick={() => handleRejectClaim(claim.id)}
                                                disabled={claimModal.processing}
                                                className="py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <HiOutlineXMark className="w-5 h-5" />
                                                Tolak
                                            </button>
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Zoom Image Modal */}
            {zoomImage && (
                <div
                    className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm"
                    onClick={() => setZoomImage(null)}
                >
                    <div className="relative w-full h-full max-w-4xl max-h-[90vh]">
                        <Image src={zoomImage} alt="Zoomed" fill className="object-contain rounded-lg shadow-2xl" />
                    </div>
                    <Button variant="ghost" size="icon" className="absolute top-6 right-6">
                        <HiOutlineXMark className="w-8 h-8" />
                    </Button>
                </div>
            )}
        </div>
    )
}

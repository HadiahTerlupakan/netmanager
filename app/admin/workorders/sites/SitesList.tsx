'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
    HiOutlineMapPin,
    HiOutlinePlus,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineMagnifyingGlass,
    HiOutlineUserGroup,
    HiOutlineClipboardDocumentList,
    HiOutlineSignal
} from 'react-icons/hi2'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'

interface Site {
    id: string
    code: string
    name: string
    description: string | null
    address: string | null
    latitude: number | null
    longitude: number | null
    attendanceRadius: number
    isActive: boolean
    createdAt: string
    updatedAt: string
    _count: {
        user: number
        work_orders: number
    }
}

export default function SitesList() {
    const { hasPermission } = usePermission()
    const canCreate = hasPermission('site:create')
    const canUpdate = hasPermission('site:update')
    const canDelete = hasPermission('site:delete')

    const [sites, setSites] = useState<Site[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [showInactive, setShowInactive] = useState(false)


    const fetchSites = useCallback(async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (search) params.append('search', search)
            if (!showInactive) params.append('activeOnly', 'true')

            const response = await fetch(`/api/admin/sites?${params}`)
            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Gagal memuat data sites')
            }

            setSites(data.data || [])
        } catch (error) {
            console.error('Failed to fetch sites:', error)
            setError(error instanceof Error ? error.message : 'Gagal memuat data')
        } finally {
            setLoading(false)
        }
    }, [search, showInactive])

    useEffect(() => {
        fetchSites()
    }, [fetchSites])

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus site "${name}"?`)) {
            return
        }

        try {
            const response = await fetch(`/api/admin/sites/${id}`, {
                method: 'DELETE',
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Gagal menghapus site')
            }

            // Refresh data
            fetchSites()
        } catch (error) {
            console.error('Failed to delete site:', error)
            alert(error instanceof Error ? error.message : 'Gagal menghapus site')
        }
    }

    const columns: Column<Site>[] = [
        {
            key: 'code',
            header: 'Info Site',
            priority: 'primary',
            render: (site) => (
                <div className="flex items-start gap-3">
                    <div className="shrink-0 h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                        {site.code}
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 dark:text-indigo-400 dark:group-hover:text-indigo-400 transition-colors">
                            {site.name}
                        </div>
                        {site.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                                {site.description}
                            </div>
                        )}
                    </div>
                </div>
            )
        },
        {
            key: 'location',
            header: 'Lokasi',
            priority: 'secondary',
            render: (site) => (
                <div className="space-y-1">
                    <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 max-w-xs">
                        {site.address || '-'}
                    </div>
                    {site.latitude && site.longitude && (
                        <a
                            href={`https://www.google.com/maps?q=${site.latitude},${site.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline"
                        >
                            <HiOutlineMapPin className="w-3 h-3" />
                            Lihat Peta
                        </a>
                    )}
                </div>
            )
        },
        {
            key: 'radius',
            header: 'Radius',
            priority: 'tertiary',
            render: (site) => (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-100 dark:border-blue-900/30 justify-center">
                    <HiOutlineSignal className="w-3.5 h-3.5" />
                    {site.attendanceRadius ?? 100}m
                </div>
            )
        },
        {
            key: 'statistics',
            header: 'Statistik',
            priority: 'secondary',
            render: (site) => (
                <div className="flex items-center justify-center gap-4">
                    <div className="flex flex-col items-center" title="Total Karyawan">
                        <span className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Pegawai</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold">
                            <HiOutlineUserGroup className="w-3 h-3" />
                            {site._count.user}
                        </span>
                    </div>
                    <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                    <div className="flex flex-col items-center" title="Total Work Orders">
                        <span className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">WO</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold">
                            <HiOutlineClipboardDocumentList className="w-3 h-3" />
                            {site._count.work_orders}
                        </span>
                    </div>
                </div>
            )
        },
        {
            key: 'status',
            header: 'Status',
            priority: 'primary',
            render: (site) => (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${site.isActive
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/30'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/30'
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${site.isActive ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}></span>
                    {site.isActive ? 'Aktif' : 'Non-Aktif'}
                </span>
            )
        }
    ]

    const renderActions = (site: Site) => (
        <div className="flex items-center justify-end gap-2 text-right">
            {canUpdate && (
                <Link
                    href={`/admin/workorders/sites/${site.id}/edit`}
                    className="p-2 text-gray-500 hover:text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                    title="Edit Site"
                >
                    <HiOutlinePencil className="h-5 w-5" />
                </Link>
            )}
            {canDelete && (
                <button
                    onClick={() => handleDelete(site.id, site.name)}
                    className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:bg-red-900/20 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Hapus Site"
                >
                    <HiOutlineTrash className="h-5 w-5" />
                </button>
            )}
        </div>
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Manajemen Sites
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Kelola lokasi dan area kerja untuk Work Orders
                    </p>
                </div>
                {canCreate && (
                    <Link
                        href="/admin/workorders/sites/new"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-shadow shadow-sm"
                    >
                        <HiOutlinePlus className="h-5 w-5 mr-2" />
                        Tambah Site
                    </Link>
                )}
            </div>

            {/* Search and Filter */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Cari berdasarkan kode, nama, atau alamat..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                </div>
                <label className="inline-flex items-center px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                    <input
                        type="checkbox"
                        checked={showInactive}
                        onChange={(e) => setShowInactive(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Tampilkan Inaktif</span>
                </label>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl text-red-800 dark:text-red-200 flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <p>{error}</p>
                </div>
            )}

            {/* Sites Table */}
            <div className="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <ResponsiveTable
                    data={sites}
                    columns={columns}
                    keyField="id"
                    loading={loading && sites.length === 0}
                    loadingMessage="Memuat data sites..."
                    emptyMessage={search ? 'Coba ubah kata kunci pencarian atau filter Anda.' : 'Belum ada site ditemukan. Mulai dengan menambahkan site baru.'}
                    renderActions={renderActions}
                />
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import { HiOutlineExclamationTriangle, HiMagnifyingGlass, HiFunnel } from 'react-icons/hi2'

interface Gudang {
    id: string
    kode: string
    nama: string
    lokasi: string | null
    siteId: string | null
    isActive: boolean
}

interface GudangSelectorProps {
    selectedIds: string[]
    onChange: (ids: string[]) => void
    currentSiteId?: string
}

export default function GudangSelector({ selectedIds, onChange, currentSiteId }: GudangSelectorProps) {
    const [gudangs, setGudangs] = useState<Gudang[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [showSelectedOnly, setShowSelectedOnly] = useState(false)
    const [page, setPage] = useState(1)
    const itemsPerPage = 10

    useEffect(() => {
        const fetchGudangs = async () => {
            try {
                // Request 'view=all' to see all warehouses regardless of user's site restriction
                // This is appropriate for the Site Management context
                const response = await fetch('/api/inventory/gudang?view=all', { cache: 'no-store' })
                const data = await response.json()
                if (response.ok) {
                    setGudangs(data.gudangs || [])
                } else {
                    setError('Gagal memuat daftar gudang')
                }
            } catch (_err) {
                setError('Gagal memuat daftar gudang')
            } finally {
                setLoading(false)
            }
        }
        fetchGudangs()
    }, [])

    const filteredGudangs = useMemo(() => {
        return gudangs.filter(g => {
            const matchesSearch =
                g.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
                g.kode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (g.lokasi && g.lokasi.toLowerCase().includes(searchTerm.toLowerCase()))

            const matchesFilter = showSelectedOnly ? selectedIds.includes(g.id) : true

            return matchesSearch && matchesFilter
        })
    }, [gudangs, searchTerm, showSelectedOnly, selectedIds])

    const totalPages = Math.ceil(filteredGudangs.length / itemsPerPage)
    const paginatedGudangs = filteredGudangs.slice((page - 1) * itemsPerPage, page * itemsPerPage)

    const handleToggle = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(sid => sid !== id))
        } else {
            onChange([...selectedIds, id])
        }
    }

    if (loading) return <div className="text-sm text-gray-500 animate-pulse">Memuat data gudang...</div>
    if (error) return <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">{error}</div>

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Hubungkan Gudang ({selectedIds.length} terpilih)
                </h3>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <HiMagnifyingGlass className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Cari nama, kode..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value)
                            setPage(1) // Reset to page 1 on search
                        }}
                        className="block w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                    className={`inline-flex items-center px-3 py-2 border text-sm leading-4 font-medium rounded-md transition-colors ${showSelectedOnly
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-700'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600'
                        }`}
                >
                    <HiFunnel className={`h-4 w-4 mr-1 ${showSelectedOnly ? 'fill-current' : 'text-gray-400'}`} />
                    {showSelectedOnly ? 'Terpilih' : 'Semua'}
                </button>
            </div>

            {/* List */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[300px] overflow-y-auto bg-white dark:bg-gray-800">
                    {paginatedGudangs.length === 0 ? (
                        <li className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 italic">
                            {searchTerm ? 'Tidak ada gudang yang cocok.' : 'Belum ada data gudang.'}
                        </li>
                    ) : (
                        paginatedGudangs.map(gudang => {
                            const isSelected = selectedIds.includes(gudang.id)
                            const assignedToOther = gudang.siteId && gudang.siteId !== currentSiteId

                            return (
                                <li
                                    key={gudang.id}
                                    className={`
                                        relative hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer
                                        ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}
                                    `}
                                    onClick={() => handleToggle(gudang.id)}
                                >
                                    <div className="px-4 py-3 flex items-start">
                                        <div className="flex items-center h-5">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => { }}
                                                className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                                            />
                                        </div>
                                        <div className="ml-3 flex-1">
                                            <div className="flex justify-between">
                                                <p className={`text-sm font-medium ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-gray-100'}`}>
                                                    {gudang.nama}
                                                </p>
                                                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                                    {gudang.kode}
                                                </span>
                                            </div>
                                            {gudang.lokasi && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                    {gudang.lokasi}
                                                </p>
                                            )}
                                            {assignedToOther && (
                                                <div className="mt-1 flex items-center text-xs text-amber-600 dark:text-amber-400 font-medium">
                                                    <HiOutlineExclamationTriangle className="h-3 w-3 mr-1" />
                                                    Reassign dari site lain
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            )
                        })
                    )}
                </ul>

                {/* Pagination Footer */}
                {totalPages > 1 && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            Hal. {page} dari {totalPages}
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={page === 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-500"
                            >
                                Prev
                            </button>
                            <button
                                type="button"
                                disabled={page === totalPages}
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-500"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <p className="text-xs text-gray-500 italic">
                Pilih gudang untuk dihubungkan ke site ini.
            </p>
        </div>
    )
}

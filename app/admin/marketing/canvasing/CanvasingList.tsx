"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { HiOutlineEye, HiOutlineMagnifyingGlass, HiOutlinePencilSquare, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi2'
import { StatusBadge } from '@/components/common/StatusBadge'
import PageLoader from '@/components/ui/PageLoader'
import ResponsiveTable from '@/components/ui/ResponsiveTable'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { toast } from 'react-hot-toast'

interface CanvasingItem {
    id: string
    nama: string
    paket: string
    alamat: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    sales: { name: string }
    createdAt: string
}

export default function CanvasingList() {
    const [items, setItems] = useState<CanvasingItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const res = await fetch('/api/marketing/canvasing')
            if (res.ok) {
                const data = await res.json()
                setItems(data)
            }
        } catch (error) {
            console.error('Failed to fetch canvasing', error)
        } finally {
            setLoading(false)
        }
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

    const filteredItems = items.filter(item => 
        item.nama.toLowerCase().includes(search.toLowerCase()) ||
        item.alamat.toLowerCase().includes(search.toLowerCase())
    )

    if (loading) return <PageLoader />

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Daftar Canvasing</h1>
                    <p className="text-sm text-gray-500">Kelola dan verifikasi request instalasi dari lapangan</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Link 
                        href="/admin/marketing/canvasing/new"
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-all shadow-sm"
                    >
                        <HiOutlinePlus className="w-5 h-5" />
                        Tambah Canvasing
                    </Link>
                    
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
                            render: (item) => <span className="text-sm">{item.sales.name}</span>
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

                            {item.status === 'PENDING' && (
                                <>
                                    <Link 
                                        href={`/admin/marketing/canvasing/${item.id}/edit`}
                                        className="text-amber-600 hover:text-amber-800 p-2 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors inline-block"
                                        title="Edit"
                                    >
                                        <HiOutlinePencilSquare className="w-5 h-5" />
                                    </Link>

                                    <button 
                                        onClick={() => handleDelete(item.id, item.nama)}
                                        className="text-red-600 hover:text-red-800 p-2 bg-red-50 hover:bg-red-100 rounded-lg transition-colors inline-block"
                                        title="Hapus"
                                    >
                                        <HiOutlineTrash className="w-5 h-5" />
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                />
            </div>
        </div>
    )
}

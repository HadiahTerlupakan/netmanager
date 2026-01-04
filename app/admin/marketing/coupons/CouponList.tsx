"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { HiOutlinePlus, HiTrash, HiPencil } from 'react-icons/hi2'
import { StatusBadge } from '@/components/common/StatusBadge'
import PageLoader from '@/components/ui/PageLoader'
import ResponsiveTable from '@/components/ui/ResponsiveTable'

interface Coupon {
    id: string
    code: string
    discountType: 'FIXED' | 'PERCENT'
    discountValue: number
    startDate: string
    endDate: string
    quota: number
    usedCount: number
    isActive: boolean
    _count: { usages: number }
}

export default function CouponList() {
    const [coupons, setCoupons] = useState<Coupon[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchCoupons()
    }, [])

    const fetchCoupons = async () => {
        try {
            const res = await fetch('/api/coupons')
            if (res.ok) {
                const data = await res.json()
                setCoupons(data)
            }
        } catch (error) {
            console.error('Failed to fetch coupons', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Apakah anda yakin ingin menghapus kupon ini?')) return
        try {
            // Assuming DELETE endpoint exists or will be added. 
            // For now just refresh or handle UI removal if endpoint not ready
            alert('Delete functionality to be implemented in API')
        } catch (error) {
            console.error('Delete failed', error)
        }
    }

    if (loading) return <PageLoader />

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Manajemen Kupon</h1>
                <Link
                    href="/admin/marketing/coupons/create"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                    <HiOutlinePlus className="w-5 h-5" />
                    Buat Kupon
                </Link>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                <ResponsiveTable<Coupon>
                    data={coupons}
                    loading={loading}
                    keyField="id"
                    columns={[
                        {
                            key: 'code',
                            header: 'Kode',
                            priority: 'primary',
                            render: (item) => <span className="font-medium text-gray-900 dark:text-white">{item.code}</span>
                        },
                        {
                            key: 'discountValue',
                            header: 'Diskon',
                            priority: 'primary',
                            render: (item) => (
                                <span>
                                    {item.discountType === 'FIXED'
                                        ? `Rp ${item.discountValue.toLocaleString('id-ID')}`
                                        : `${item.discountValue}%`
                                    }
                                </span>
                            )
                        },
                        {
                            key: 'berlaku',
                            header: 'Berlaku',
                            priority: 'secondary',
                            render: (item) => (
                                <div className="text-xs space-y-1">
                                    <div>Mulai: {new Date(item.startDate).toLocaleDateString()}</div>
                                    <div>Selesai: {new Date(item.endDate).toLocaleDateString()}</div>
                                </div>
                            )
                        },
                        {
                            key: 'quota',
                            header: 'Penggunaan / Kuota',
                            priority: 'secondary',
                            render: (item) => (
                                <div className="flex items-center gap-2">
                                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 max-w-[100px]">
                                        <div
                                            className="bg-blue-600 h-2.5 rounded-full"
                                            style={{ width: `${Math.min((item.usedCount / (item.quota || 1)) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-xs">
                                        {item.usedCount} / {item.quota === 0 ? 'ထ' : item.quota}
                                    </span>
                                </div>
                            )
                        },
                        {
                            key: 'isActive',
                            header: 'Status',
                            priority: 'primary',
                            render: (item) => <StatusBadge status={item.isActive ? 'AKTIF' : 'NONAKTIF'} />
                        }
                    ]}
                    emptyMessage="Tidak ada kupon ditemukan. Buat satu untuk memulai."
                    renderActions={(item) => (
                        <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800 p-2">
                            <HiTrash className="w-5 h-5" />
                        </button>
                    )}
                />
            </div>
        </div>
    )
}

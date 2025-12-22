"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { HiOutlinePlus, HiTrash, HiPencil } from 'react-icons/hi2'
import { StatusBadge } from '@/components/common/StatusBadge'
import PageLoader from '@/components/ui/PageLoader'

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
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-4">Kode</th>
                                <th className="px-6 py-4">Diskon</th>
                                <th className="px-6 py-4">Berlaku</th>
                                <th className="px-6 py-4">Penggunaan / Kuota</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {coupons.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        Tidak ada kupon ditemukan. Buat satu untuk memulai.
                                    </td>
                                </tr>
                            ) : (
                                coupons.map((coupon) => (
                                    <tr key={coupon.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {coupon.code}
                                        </td>
                                        <td className="px-6 py-4">
                                            {coupon.discountType === 'FIXED'
                                                ? `Rp ${coupon.discountValue.toLocaleString('id-ID')}`
                                                : `${coupon.discountValue}%`
                                            }
                                        </td>
                                        <td className="px-6 py-4 text-xs space-y-1">
                                            <div>Mulai: {new Date(coupon.startDate).toLocaleDateString()}</div>
                                            <div>Selesai: {new Date(coupon.endDate).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 max-w-[100px]">
                                                    <div
                                                        className="bg-blue-600 h-2.5 rounded-full"
                                                        style={{ width: `${Math.min((coupon.usedCount / (coupon.quota || 1)) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-xs">
                                                    {coupon.usedCount} / {coupon.quota === 0 ? 'ထ' : coupon.quota}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={coupon.isActive ? 'AKTIF' : 'NONAKTIF'} />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => handleDelete(coupon.id)} className="text-red-600 hover:text-red-800 p-2">
                                                <HiTrash className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

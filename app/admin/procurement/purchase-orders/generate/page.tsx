"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { HiArrowLeft, HiCheck, HiRefresh } from 'react-icons/hi'
import ResponsiveTable, { type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'
import toast from 'react-hot-toast'

interface PurchaseRequest {
    id: string
    nomorRequest: string
    tanggal: string
    prioritas: string
    items: {
        barang: { nama: string; supplierId: string | null }
    }[]
    requester: { name: string }
}

export default function GeneratePOPage() {
    const router = useRouter()
    const { hasPermission: can } = usePermission()
    
    // Permission check
    const canCreate = can('purchase_orders:create')

    const [data, setData] = useState<PurchaseRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (canCreate) {
            fetchData()
        }
    }, [canCreate])

    const fetchData = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/procurement/purchase-requests/available')
            if (!res.ok) throw new Error('Failed to fetch data')
            const json = await res.json()
            setData(json)
        } catch (error) {
            console.error(error)
            toast.error("Gagal mengambil data PR")
        } finally {
            setLoading(false)
        }
    }

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    const handleGenerate = async () => {
        if (selectedIds.size === 0) return
        if (!confirm(`Generate Purchase Order dari ${selectedIds.size} PR terpilih?`)) return

        setIsSubmitting(true)
        try {
            const res = await fetch('/api/procurement/purchase-orders/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prIds: Array.from(selectedIds) })
            })

            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed')

            toast.success(`Berhasil membuat ${json.length} Purchase Order`)
            router.push('/admin/procurement/purchase-orders')
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    const columns: Column<PurchaseRequest>[] = [
        {
            header: '',
            key: 'select',
            className: 'w-10',
            render: (row) => (
                <input
                    type="checkbox"
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggleSelection(row.id)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
            )
        },
        {
            header: 'No. Request',
            key: 'nomorRequest',
            render: (row) => <span className="font-medium">{row.nomorRequest}</span>
        },
        {
            header: 'Tanggal',
            key: 'tanggal',
            render: (row) => new Date(row.tanggal).toLocaleDateString('id-ID')
        },
        {
            header: 'Prioritas',
            key: 'prioritas',
            render: (row) => (
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                    row.prioritas === 'URGENT' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                }`}>
                    {row.prioritas}
                </span>
            )
        },
        {
            header: 'Requester',
            key: 'requester.name',
            render: (row) => row.requester?.name || '-'
        },
        {
            header: 'Items',
            key: 'items',
            render: (row) => (
                <span className="text-xs text-gray-500">
                    {row.items.length} Barang
                </span>
            )
        }
    ]

    if (!canCreate) {
        return <div className="p-8 text-center text-red-500">Unauthorized</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => router.back()}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <HiArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Generate PO</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Pilih PR Approved untuk dibuatkan PO</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchData}
                        className="p-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        <HiRefresh className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={selectedIds.size === 0 || isSubmitting}
                        className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                        <HiCheck className="w-5 h-5" />
                        {isSubmitting ? 'Processing...' : 'Generate PO'}
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <ResponsiveTable
                    data={data}
                    columns={columns}
                    loading={loading}
                    keyField="id"
                    emptyMessage="Tidak ada PR Approved yang belum diproses."
                />
            </div>
        </div>
    )
}

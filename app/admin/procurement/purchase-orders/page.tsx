"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { HiPlus, HiRefresh, HiSearch, HiPencil, HiTrash, HiDocumentText, HiChevronLeft, HiChevronRight, HiDotsVertical, HiOutlineShoppingBag, HiOutlineArchive, HiEye, HiClipboardList, HiCollection } from 'react-icons/hi'
import ResponsiveTable, { type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'

import toast from 'react-hot-toast'
import ReceiveGoodsModal from './_components/ReceiveGoodsModal'
import PurchaseRequestTab from './_components/PurchaseRequestTab'


interface PurchaseOrder {
    id: string
    poNumber: string
    supplier?: {
        name: string
    } | null
    status: string
    totalAmount: number
    createdAt: string
    creator?: { name: string } | null
    processedBy?: { name: string } | null
    receivedBy?: { name: string } | null
}

export default function PurchaseOrderListPage() {
    const { data: session } = useSession()
    const router = useRouter()
    const { hasPermission: can } = usePermission()
    
    // Tab state
    const [activeTab, setActiveTab] = useState<'po' | 'pr'>('pr')
    
    // Permission check
    const canCreate = can('purchase_orders:create')
    const canRead = can('purchase_orders:read')
    const canUpdate = can('purchase_orders:update')
    const canDelete = can('purchase_orders:delete')

    const [data, setData] = useState<PurchaseOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [limit] = useState(10)
    const [total, setTotal] = useState(0)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500)
        return () => clearTimeout(timer)
    }, [search])

    useEffect(() => {
        if (session && canRead && activeTab === 'po') {
            fetchData()
        }
    }, [session, page, debouncedSearch, canRead, activeTab])

    const fetchData = async () => {
        setLoading(true)
        try {
            const skip = (page - 1) * limit
            const params = new URLSearchParams({
                skip: skip.toString(),
                take: limit.toString(),
                ...(debouncedSearch && { search: debouncedSearch })
            })
            
            const res = await fetch(`/api/procurement/purchase-orders?${params}`)
            if (!res.ok) throw new Error('Failed to fetch purchase orders')
            
            const json = await res.json()
            setData(json.data)
            setTotal(json.total)
        } catch (error) {
            console.error(error)
            toast.error("Gagal mengambil data PO")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Apakah anda yakin ingin menghapus PO ini?')) return
        try {
            const res = await fetch(`/api/procurement/purchase-orders/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete')
            toast.success('PO berhasil dihapus')
            fetchData()
        } catch (error) {
            toast.error('Gagal menghapus PO')
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount)
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'DRAFT': return 'bg-gray-100 text-gray-800'
            case 'ORDERED': return 'bg-blue-100 text-blue-800'
            case 'RECEIVED': return 'bg-green-100 text-green-800'
            case 'CANCELLED': return 'bg-red-100 text-red-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const [processingId, setProcessingId] = useState<string | null>(null)
    
    // Modal Receive Goods State
    const [selectedPO, setSelectedPO] = useState<any>(null)
    const [showReceiveModal, setShowReceiveModal] = useState(false)
    const [loadingDetail, setLoadingDetail] = useState(false)

    const handleStartShopping = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation()
        if (!confirm('Mulai proses belanja? Status akan berubah menjadi PROCESSING.')) return
        
        setProcessingId(id)
        try {
            const res = await fetch(`/api/procurement/purchase-orders/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'START_SHOPPING' })
            })
            if (!res.ok) throw new Error('Gagal update status')
            
            toast.success('Status update: Sedang Dibelanjakan')
            fetchData()
        } catch (e) {
            toast.error('Gagal update status')
        } finally {
            setProcessingId(null)
        }
    }

    const handleReceiveGoods = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation()

        setLoadingDetail(true)
        try {
            // Fetch full PO details including items
            const res = await fetch(`/api/procurement/purchase-orders/${id}`)
            if (!res.ok) throw new Error('Gagal memuat detail PO')
            const po = await res.json()
            
            setSelectedPO(po)
            setShowReceiveModal(true)
        } catch (error) {
            toast.error("Gagal memuat detail PO")
        } finally {
            setLoadingDetail(false)
        }
    }


    const columns: Column<PurchaseOrder>[] = [
        {
            header: 'No. PO',
            key: 'poNumber',
            render: (row) => <span className="font-medium text-indigo-600 dark:text-indigo-400">{row.poNumber}</span>
        },

        {
            header: 'Tanggal',
            key: 'createdAt',
            render: (row) => new Date(row.createdAt).toLocaleDateString('id-ID')
        },
        {
            header: 'Total',
            key: 'totalAmount',
            render: (row) => formatCurrency(row.totalAmount)
        },
        {
            header: 'Status',
            key: 'status',
            render: (row) => (
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(row.status)}`}>
                    {row.status}
                </span>
            )
        },
        {
            header: 'PIC',
            key: 'creator.name',
            render: (row) => (
                <div className="flex flex-col text-xs gap-1">
                    <div className="flex items-center gap-1 text-gray-500" title="Dibuat Oleh">
                        <span>📝</span> {row.creator?.name || 'System'}
                    </div>
                    {row.processedBy && (
                        <div className="flex items-center gap-1 text-blue-600" title="Diproses Oleh">
                            <span>🛍️</span> {row.processedBy.name}
                        </div>
                    )}
                    {row.receivedBy && (
                        <div className="flex items-center gap-1 text-green-600" title="Diterima Oleh">
                            <span>📦</span> {row.receivedBy.name}
                        </div>
                    )}
                </div>
            )
        },
        {
            header: 'Aksi',
            key: 'id',
            className: 'text-center w-40', // Increase width for buttons
            render: (row) => (
                <div className="flex justify-center gap-2">
                    <button
                        onClick={() => router.push(`/admin/procurement/purchase-orders/${row.id}?mode=view`)}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Detail"
                    >
                        <HiEye className="w-5 h-5" />
                    </button>
                    {canUpdate && (
                         <button
                            onClick={() => router.push(`/admin/procurement/purchase-orders/${row.id}`)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                        >
                            <HiPencil className="w-5 h-5" />
                        </button>
                    )}

                    {canUpdate && row.status === 'DRAFT' && (
                        <button
                            onClick={(e) => handleStartShopping(row.id, e)}
                            disabled={processingId === row.id}
                            className={`p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ${processingId === row.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Mulai Belanja"
                        >
                            <HiOutlineShoppingBag className="w-5 h-5" />
                        </button>
                    )}

                    {canUpdate && row.status === 'ORDERED' && (
                        <button
                            onClick={(e) => handleReceiveGoods(row.id, e)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Terima Barang"
                        >
                            <HiOutlineArchive className="w-5 h-5" />
                        </button>
                    )}

                    {canDelete && ['DRAFT', 'ORDERED', 'CANCELLED'].includes(row.status) && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(row.id)
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                        >
                            <HiTrash className="w-5 h-5" />
                        </button>
                    )}
                </div>
            )
        }
    ]

    const totalPages = Math.ceil(total / limit)
    


    if (!canRead) {
        return <div className="p-4 text-center text-red-500">Anda tidak memiliki akses untuk melihat data ini.</div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Procurement</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Kelola Purchase Request dan Purchase Order</p>
                </div>
                <div className="flex gap-2">
                    {canCreate && activeTab === 'po' && (
                        <>
                             <div className="relative group">
                                <button
                                    onClick={() => router.push('/admin/procurement/purchase-orders/create')}
                                    className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                                >
                                    <HiPlus className="w-5 h-5" />
                                    Manual PO
                                </button>
                             </div>
                        </>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('pr')}
                        className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === 'pr'
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                    >
                        <HiClipboardList className="w-5 h-5" />
                        Purchase Requests
                    </button>
                    <button
                        onClick={() => setActiveTab('po')}
                        className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === 'po'
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                    >
                        <HiCollection className="w-5 h-5" />
                        Purchase Orders
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'pr' ? (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <PurchaseRequestTab />
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="relative flex-1">
                            <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Cari No. PO..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <button
                            onClick={fetchData}
                            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                        >
                            <HiRefresh className="w-5 h-5" />
                        </button>
                    </div>

                    <ResponsiveTable
                        data={data}
                        columns={columns}
                        loading={loading}
                        keyField="id"
                    />

                    {/* Pagination */}
                    {total > 0 && (
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                Halaman {page} dari {totalPages} ({total} Data)
                            </span>
                            <div className="flex gap-2">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(p => p - 1)}
                                    className="flex items-center gap-1 px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent dark:border-gray-600 dark:hover:bg-gray-700"
                                >
                                    <HiChevronLeft /> Prev
                                </button>
                                <button
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(p => p + 1)}
                                    className="flex items-center gap-1 px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent dark:border-gray-600 dark:hover:bg-gray-700"
                                >
                                    Next <HiChevronRight />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {showReceiveModal && selectedPO && (
                <ReceiveGoodsModal 
                    isOpen={showReceiveModal}
                    onClose={() => setShowReceiveModal(false)}
                    po={selectedPO}
                    onSuccess={() => {
                        fetchData()
                        setShowReceiveModal(false)
                    }}
                />
            )}
        </div>

    )
}


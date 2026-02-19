"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PurchaseOrderForm from '../_components/PurchaseOrderForm'
import ReceiveGoodsModal from '../_components/ReceiveGoodsModal'
import { Button } from '@/components/ui/Button'
import { usePermission } from '@/hooks/use-permission'
import toast from 'react-hot-toast'
import React from 'react'
import { HiChevronDown } from 'react-icons/hi'

interface PurchaseOrderItem {
    id: string
    barangId: string
    barang?: {
        nama: string
        satuan?: string
    }
    quantity: number
    unitPrice: number
}

interface PurchaseOrder {
    id: string
    poNumber: string
    status: string
    items: PurchaseOrderItem[]
    totalAmount: number
    notes?: string
    creator?: {
        name: string
    }
}

export default function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter()
    const { hasPermission, isLoading: loadingAuth } = usePermission()

    // Unwrapping params
    const resolvedParams = React.use(params)
    const id = resolvedParams.id
    const searchParams = useSearchParams()

    const [po, setPo] = useState<PurchaseOrder | null>(null)
    const [loading, setLoading] = useState(true)
    const [showReceiveModal, setShowReceiveModal] = useState(false)
    const [showActions, setShowActions] = useState(false)
    const [processingAction, setProcessingAction] = useState(false)

    // Check read permission
    useEffect(() => {
        if (!loadingAuth && !hasPermission('purchase_orders:read')) {
            router.push('/admin/procurement/purchase-orders')
        }
    }, [loadingAuth, hasPermission, router])

    const fetchPO = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/procurement/purchase-orders/${id}`)
            if (!res.ok) throw new Error('Tidak ditemukan')
            const json = await res.json()
            setPo(json)
        } catch (_error) {
            toast.error("Gagal memuat PO")
            router.push('/admin/procurement/purchase-orders')
        } finally {
            setLoading(false)
        }
    }, [id, router])

    useEffect(() => {
        if (!loadingAuth && hasPermission('purchase_orders:read')) {
            fetchPO()
        }
    }, [id, loadingAuth, hasPermission, fetchPO])

    const handleStartShopping = async () => {
        if (!confirm('Mulai proses belanja? Status akan berubah menjadi PROCESSING dan tidak bisa diedit lagi.')) return
        
        setProcessingAction(true)
        try {
            const res = await fetch(`/api/procurement/purchase-orders/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'START_SHOPPING' })
            })
            if (!res.ok) throw new Error('Gagal update status')
            
            toast.success('Status update: Sedang Dibelanjakan')
            fetchPO()
        } catch (_e) {
            toast.error('Gagal update status')
        } finally {
            setProcessingAction(false)
        }
    }

    if (loadingAuth || loading) return <div>Loading...</div>
    if (!po) return null

    // Determine if editable: DRAFT status + Update Permission
    const canEdit = hasPermission('purchase_orders:update') && po.status === 'DRAFT'
    const canProcess = hasPermission('purchase_orders:update') && po.status === 'DRAFT'
    const canReceive = hasPermission('purchase_orders:receive') && (po.status === 'ORDERED' || po.status === 'PARTIAL') 
                       // Note: Schema uses ORDERED, we map UI "Sedang Belanja" to ORDERED for backend consistency
                       // Or we define 'PROCESSING' enum? Let's stick to schema default 'ORDERED' but label it 'Sedang Belanja'.

    return (
        <div className="space-y-4">
             {/* Action Bar for Workflow */}
             <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-full text-sm font-bold 
                        ${po.status === 'DRAFT' ? 'bg-gray-100 text-gray-700' : 
                          po.status === 'ORDERED' ? 'bg-blue-100 text-blue-700' :
                          po.status === 'COMPLETED' || po.status === 'RECEIVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {po.status === 'ORDERED' ? 'SEDANG BELANJA' : po.status}
                    </div>
                    {po.status !== 'DRAFT' && (
                        <span className="text-sm text-gray-500">Read Only Mode</span>
                    )}
                </div>

                <div className="flex gap-2">
                <div className="relative">
                    {(canProcess || canReceive) && (
                        <>
                            <Button 
                                onClick={() => setShowActions(!showActions)}
                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm flex items-center gap-2"
                            >
                                Aksi <HiChevronDown className={`w-4 h-4 transition-transform ${showActions ? 'rotate-180' : ''}`} />
                            </Button>

                            {showActions && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-10"
                                        onClick={() => setShowActions(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-20 py-1">
                                        {canProcess && (
                                            <Button
                                                onClick={() => {
                                                    setShowActions(false)
                                                    handleStartShopping()
                                                }}
                                                disabled={processingAction}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                            >
                                                {processingAction ? 'Memproses...' : 'Mulai Belanja'}
                                            </Button>
                                        )}
                                        {canReceive && (
                                            <Button
                                                onClick={() => {
                                                    setShowActions(false)
                                                    setShowReceiveModal(true)
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                                            >
                                                Terima Barang
                                            </Button>
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
                </div>
             </div>


             <PurchaseOrderForm 
                initialData={po} 
                isEdit={true} 
                disabled={!canEdit}
                readOnly={searchParams.get('mode') === 'view'}
            />


            {showReceiveModal && (
                <ReceiveGoodsModal 
                    isOpen={showReceiveModal}
                    onClose={() => setShowReceiveModal(false)}
                    po={po}
                    onSuccess={() => {
                        fetchPO()
                        setShowReceiveModal(false)
                    }}
                />
            )}
        </div>
    )
}

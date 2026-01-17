"use client"

import PurchaseOrderForm from '../_components/PurchaseOrderForm'
import { usePermission } from '@/hooks/use-permission'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function CreatePurchaseOrderPage() {
    const router = useRouter()
    const { hasPermission, isLoading } = usePermission()

    useEffect(() => {
        if (!isLoading && !hasPermission('purchase_orders:create')) {
            router.push('/admin/procurement/purchase-orders')
        }
    }, [isLoading, hasPermission, router])

    if (isLoading) return <div>Loading...</div>
    if (!hasPermission('purchase_orders:create')) return null

    return <PurchaseOrderForm />
}

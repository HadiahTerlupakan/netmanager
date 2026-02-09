import type { Metadata } from 'next'
import { ensureAnyPermission } from '@/lib/rbac'
import SalesListClient from './SalesListClient'

export const metadata: Metadata = {
    title: 'Manajemen Sales | NetManager',
    description: 'Kelola tim sales dan target canvasing',
}

export default async function SalesPage() {
    await ensureAnyPermission(['sales:read', 'canvasing:read'])
    return (
        <div className="p-6 max-w-7xl mx-auto">
            <SalesListClient />
        </div>
    )
}

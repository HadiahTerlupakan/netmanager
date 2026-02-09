import { ensureAnyPermission } from '@/lib/rbac'
import SalesDetailClient from './SalesDetailClient'

export default async function SalesDetailPage({ params }: { params: Promise<{ id: string }> }) {
    await ensureAnyPermission(['sales:read', 'canvasing:read'])
    return (
        <div className="p-6">
            <SalesDetailClient params={params} />
        </div>
    )
}

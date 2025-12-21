import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './OdcDetailClient'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('odc:read')
    return await ClientComponent({ params })
}

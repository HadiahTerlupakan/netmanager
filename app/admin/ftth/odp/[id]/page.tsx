import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './OdpDetailClient'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('odp:read')
    return await ClientComponent({ params })
}

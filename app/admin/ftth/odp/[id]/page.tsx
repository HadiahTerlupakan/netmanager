import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './OdpDetailClient'

export default async function Page() {
    await ensurePermission('odp:read')
    return <ClientComponent />
}

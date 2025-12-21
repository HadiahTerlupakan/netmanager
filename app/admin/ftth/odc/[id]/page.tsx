import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './OdcDetailClient'

export default async function Page() {
    await ensurePermission('odc:read')
    return <ClientComponent />
}

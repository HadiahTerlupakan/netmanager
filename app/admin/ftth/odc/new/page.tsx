import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './OdcNewClient'

export default async function Page() {
    await ensurePermission('odc:create')
    return <ClientComponent />
}

import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './MikrotikNewClient'

export default async function Page() {
    await ensurePermission('mikrotik:create')
    return <ClientComponent />
}

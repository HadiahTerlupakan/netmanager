import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './MikrotikEditClient'

export default async function Page() {
    await ensurePermission('mikrotik:update')
    return <ClientComponent />
}

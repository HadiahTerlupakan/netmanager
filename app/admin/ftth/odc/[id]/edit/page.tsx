import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './OdcEditClient'

export default async function Page() {
    await ensurePermission('odc:update')
    return <ClientComponent />
}

import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './SitesNewClient'

export default async function Page() {
    await ensurePermission('sites:create')
    return <ClientComponent />
}

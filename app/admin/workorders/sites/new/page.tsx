import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './SitesNewClient'

export default async function Page() {
    await ensurePermission('site:create')
    return <ClientComponent />
}

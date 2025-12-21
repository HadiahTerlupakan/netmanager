import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './SitesEditClient'

export default async function Page() {
    await ensurePermission('sites:update')
    return <ClientComponent />
}

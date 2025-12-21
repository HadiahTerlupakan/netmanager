import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './RolesDetailClient'

export default async function Page() {
    await ensurePermission('roles:read')
    return <ClientComponent />
}

import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './RolesClient'

export default async function RolesPage() {
    await ensurePermission('roles:read')
    return <RolesClient />
}

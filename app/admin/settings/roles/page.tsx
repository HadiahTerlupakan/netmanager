import { ensurePermission } from '@/lib/rbac'
import { RolesClient } from './RolesClient'

export default async function RolesPage() {
    await ensurePermission('roles:read')
    return <RolesClient />
}

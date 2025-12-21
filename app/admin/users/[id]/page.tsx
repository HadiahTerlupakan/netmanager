import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './UsersDetailClient'

export default async function Page() {
    await ensurePermission('users:read')
    return <ClientComponent />
}

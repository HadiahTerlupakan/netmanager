import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './UsersNewClient'

export default async function Page() {
    await ensurePermission('users:create')
    return <ClientComponent />
}

import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './DeptNewClient'

export default async function Page() {
    await ensurePermission('department:create')
    return <ClientComponent />
}

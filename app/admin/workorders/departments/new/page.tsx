import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './DeptNewClient'

export default async function Page() {
    await ensurePermission('departments:create')
    return <ClientComponent />
}

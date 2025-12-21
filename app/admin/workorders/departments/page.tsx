import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './DeptIndexClient'

export default async function Page() {
    await ensurePermission('departments:read')
    return <ClientComponent />
}

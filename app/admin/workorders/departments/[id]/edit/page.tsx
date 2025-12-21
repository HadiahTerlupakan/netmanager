import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './DeptEditClient'

export default async function Page() {
    await ensurePermission('departments:update')
    return <ClientComponent />
}

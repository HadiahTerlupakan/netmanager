import { ensureAnyPermission } from '@/lib/rbac'
import { ClientComponent } from './WoIndexClient'

export default async function Page() {
    await ensureAnyPermission(['work_order_dashboard:read', 'list:read', 'site:read', 'department:read'])
    return <ClientComponent />
}

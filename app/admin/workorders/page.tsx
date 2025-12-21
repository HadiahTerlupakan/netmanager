import { ensureAnyPermission } from '@/lib/rbac'
import { ClientComponent } from './WoIndexClient'

export default async function Page() {
    await ensureAnyPermission(['workorder:read', 'departments:read', 'sites:read'])
    return <ClientComponent />
}

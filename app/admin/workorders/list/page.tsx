import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './WoListClient'

export default async function Page() {
    await ensurePermission('workorder:read')
    return <ClientComponent />
}

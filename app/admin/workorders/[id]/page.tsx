import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './WoDetailClient'

export default async function Page() {
    await ensurePermission('workorder:read')
    return <ClientComponent />
}

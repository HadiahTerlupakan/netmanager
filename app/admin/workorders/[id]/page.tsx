import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './WoDetailClient'

export default async function Page() {
    await ensurePermission('list:read')
    return <ClientComponent />
}

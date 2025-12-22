import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './WoListClient'

export default async function Page() {
    await ensurePermission('list:read')
    return <ClientComponent />
}

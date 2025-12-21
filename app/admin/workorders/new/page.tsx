import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './WoNewClient'

export default async function Page() {
    await ensurePermission('workorder:create')
    return <ClientComponent />
}

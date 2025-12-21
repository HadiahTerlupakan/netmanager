import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './ClosureNewClient'

export default async function Page() {
    await ensurePermission('closure:create')
    return <ClientComponent />
}

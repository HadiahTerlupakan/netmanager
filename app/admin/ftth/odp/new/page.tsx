import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './OdpNewClient'

export default async function Page() {
    await ensurePermission('odp:create')
    return <ClientComponent />
}

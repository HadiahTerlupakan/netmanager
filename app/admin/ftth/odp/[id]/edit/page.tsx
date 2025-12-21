import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './OdpEditClient'

export default async function Page() {
    await ensurePermission('odp:update')
    return <ClientComponent />
}

import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './OnuNewClient'

export default async function Page() {
    await ensurePermission('onu:create')
    return <ClientComponent />
}

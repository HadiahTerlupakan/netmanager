import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './KmzNewClient'

export default async function Page() {
    await ensurePermission('kmz:create')
    return <ClientComponent />
}

import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './GudangNewClient'

export default async function Page() {
    await ensurePermission('gudang:create')
    return <ClientComponent />
}

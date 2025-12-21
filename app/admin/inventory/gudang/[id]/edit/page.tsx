import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './GudangEditClient'

export default async function Page() {
    await ensurePermission('gudang:update')
    return <ClientComponent />
}

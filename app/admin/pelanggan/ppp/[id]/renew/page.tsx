import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './PppRenewClient'

export default async function Page() {
    await ensurePermission('pelanggan:update')
    return <ClientComponent />
}

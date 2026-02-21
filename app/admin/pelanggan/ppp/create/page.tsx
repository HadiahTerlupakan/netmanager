import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './PppNewClient'

export default async function Page() {
    await ensurePermission('pelanggan:create')
    return <ClientComponent />
}

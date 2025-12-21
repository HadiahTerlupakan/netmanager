import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './PppEditClient'

export default async function Page() {
    await ensurePermission('pelanggan:update')
    return <ClientComponent />
}

import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './PppDetailClient'

export default async function Page() {
    await ensurePermission('pelanggan:read')
    return <ClientComponent />
}

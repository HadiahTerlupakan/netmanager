import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './PppPrintClient'

export default async function Page() {
    await ensurePermission('pelanggan:read')
    return <ClientComponent />
}

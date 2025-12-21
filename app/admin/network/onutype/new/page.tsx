import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './OnuTypeNewClient'

export default async function Page() {
    await ensurePermission('onutype:create')
    return <ClientComponent />
}

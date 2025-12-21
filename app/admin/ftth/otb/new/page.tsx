import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './OtbNewClient'

export default async function Page() {
    await ensurePermission('otb:create')
    return <ClientComponent />
}

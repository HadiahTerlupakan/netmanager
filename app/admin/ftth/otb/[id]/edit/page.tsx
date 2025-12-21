import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './OtbEditClient'

export default async function Page() {
    await ensurePermission('otb:update')
    return <ClientComponent />
}

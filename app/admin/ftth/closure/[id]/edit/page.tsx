import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './ClosureEditClient'

export default async function Page() {
    await ensurePermission('closure:update')
    return <ClientComponent />
}

import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './ClosureDetailClient'

export default async function Page() {
    await ensurePermission('closure:read')
    return <ClientComponent />
}

import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './OtbDetailClient'

export default async function Page() {
    await ensurePermission('otb:read')
    return <ClientComponent />
}

import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './SupportDetailClient'

export default async function Page() {
    await ensurePermission('support:read')
    return <ClientComponent />
}

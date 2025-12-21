import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './PoleDetailClient'

export default async function Page() {
    await ensurePermission('pole:read')
    return <ClientComponent />
}

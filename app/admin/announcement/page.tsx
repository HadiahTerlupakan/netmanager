import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './AnnouncementIndexClient'

export default async function Page() {
    await ensurePermission('announcement:read')
    return <ClientComponent />
}

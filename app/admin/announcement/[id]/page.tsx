import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './AnnouncementDetailClient'

export default async function Page() {
    await ensurePermission('announcement:read')
    return <ClientComponent />
}

import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './AnnouncementCreateClient'

export default async function Page() {
    await ensurePermission('announcement:create')
    return <ClientComponent />
}

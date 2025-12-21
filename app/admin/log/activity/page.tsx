import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './ActivityLogClient'

export default async function ActivityLogPage() {
    await ensurePermission('activity:read')
    return <ActivityLogClient />
}

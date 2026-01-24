import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './ActivityLogClient'

export default async function ActivityLogPage() {
    await ensurePermission('system_log:read')
    return <ClientComponent />
}

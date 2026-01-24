import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './LoginLogClient'

export default async function LoginLogPage() {
    await ensurePermission('system_log:read')
    return <ClientComponent />
}

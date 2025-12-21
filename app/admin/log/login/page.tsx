import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './LoginLogClient'

export default async function LoginLogPage() {
    await ensurePermission('login:read')
    return <LoginLogClient />
}

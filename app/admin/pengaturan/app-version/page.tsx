import { ensurePermission } from '@/lib/rbac'
import { AppVersionClient } from './AppVersionClient'

export default async function AppVersionPage() {
    await ensurePermission('app_version:read')
    return <AppVersionClient />
}

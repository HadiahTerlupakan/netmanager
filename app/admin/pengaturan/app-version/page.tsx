import { ensurePermission, ensureMainTenant } from '@/lib/rbac'
import { AppVersionClient } from './AppVersionClient'

export default async function AppVersionPage() {
    await ensureMainTenant()
    await ensurePermission('app_version:read')
    return <AppVersionClient />
}

import { ensurePermission } from '@/lib/rbac'
import { ApiSettingsClient } from './ApiSettingsClient'

export default async function ApiSettingsPage() {
    await ensurePermission('api:read')
    return <ApiSettingsClient />
}

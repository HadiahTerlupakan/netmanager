import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './ApiSettingsClient'

export default async function ApiSettingsPage() {
    await ensurePermission('api:read')
    return <ApiSettingsClient />
}

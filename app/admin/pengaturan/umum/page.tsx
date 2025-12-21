import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './GeneralSettingsClient'

export default async function GeneralSettingsPage() {
    await ensurePermission('umum:read')
    return <ClientComponent />
}

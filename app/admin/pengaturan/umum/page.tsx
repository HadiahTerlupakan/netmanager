import { ensurePermission } from '@/lib/rbac'
import { GeneralSettingsClient } from './GeneralSettingsClient'

export default async function GeneralSettingsPage() {
    await ensurePermission('umum:read')
    return <GeneralSettingsClient />
}

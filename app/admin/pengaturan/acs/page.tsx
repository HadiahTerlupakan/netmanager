import { ensurePermission } from '@/lib/rbac'
import { AcsSettingsClient } from './AcsSettingsClient'

export default async function AcsSettingsPage() {
    await ensurePermission('pengaturan:read')
    return <AcsSettingsClient />
}
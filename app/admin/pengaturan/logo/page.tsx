import { ensurePermission } from '@/lib/rbac'
import { LogoSettingsClient } from './LogoSettingsClient'

export default async function LogoSettingsPage() {
    await ensurePermission('logo:read')
    return <LogoSettingsClient />
}

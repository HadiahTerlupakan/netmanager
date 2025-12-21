import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './LogoSettingsClient'

export default async function LogoSettingsPage() {
    await ensurePermission('logo:read')
    return <ClientComponent />
}

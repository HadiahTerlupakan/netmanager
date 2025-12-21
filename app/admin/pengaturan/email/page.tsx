import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './EmailSettingsClient'

export default async function EmailSettingsPage() {
    await ensurePermission('email:read')
    return <ClientComponent />
}

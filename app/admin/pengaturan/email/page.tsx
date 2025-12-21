import { ensurePermission } from '@/lib/rbac'
import { EmailSettingsClient } from './EmailSettingsClient'

export default async function EmailSettingsPage() {
    await ensurePermission('email:read')
    return <EmailSettingsClient />
}

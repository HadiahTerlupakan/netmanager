import { ensurePermission } from '@/lib/rbac'
import { WhatsappSettingsClient } from './WhatsappSettingsClient'

export default async function WhatsappSettingsPage() {
    await ensurePermission('whatsapp:read')
    return <WhatsappSettingsClient />
}

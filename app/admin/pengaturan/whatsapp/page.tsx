import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './WhatsappSettingsClient'

export default async function WhatsappSettingsPage() {
    await ensurePermission('whatsapp:read')
    return <ClientComponent />
}

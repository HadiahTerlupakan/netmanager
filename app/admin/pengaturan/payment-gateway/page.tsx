import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './PaymentSettingsClient'

export default async function PaymentSettingsPage() {
    await ensurePermission('payment_gateway:read')
    return <ClientComponent />
}

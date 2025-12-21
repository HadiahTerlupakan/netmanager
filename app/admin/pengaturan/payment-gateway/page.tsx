import { ensurePermission } from '@/lib/rbac'
import { PaymentSettingsClient } from './PaymentSettingsClient'

export default async function PaymentSettingsPage() {
    await ensurePermission('payment_gateway:read')
    return <PaymentSettingsClient />
}

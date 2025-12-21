import { ensureAnyPermission } from '@/lib/rbac'
import { ClientComponent } from './PengaturanIndexClient'

export default async function Page() {
    await ensureAnyPermission(['umum:read', 'logo:read', 'email:read', 'whatsapp:read', 'api:read', 'captcha:read', 'payment_gateway:read', 'bank_accounts:read'])
    return <ClientComponent />
}

import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './RegistrationDetailClient'

export default async function Page() {
    await ensurePermission('registration:read')
    return <ClientComponent />
}

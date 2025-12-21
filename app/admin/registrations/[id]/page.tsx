import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './RegistrationDetailClient'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('registrations:read')
    return await ClientComponent({ params })
}

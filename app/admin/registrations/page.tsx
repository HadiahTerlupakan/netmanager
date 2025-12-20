import { ensurePermission } from '@/lib/rbac'
import RegistrationList from './RegistrationList'

export const dynamic = 'force-dynamic'

export default async function RegistrationPage() {
    await ensurePermission('registration:read')

    return <RegistrationList />
}

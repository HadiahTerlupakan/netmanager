import { ensurePermission } from '@/lib/rbac'
import SalaryUsersClient from './SalaryUsersClient'

export default async function SalaryUsersPage() {
    await ensurePermission('salary:read')
    return <SalaryUsersClient />
}

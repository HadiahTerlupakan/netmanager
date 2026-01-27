import { ensurePermission } from '@/lib/rbac'
import SalaryListClient from './SalaryListClient'

export default async function SalaryPage() {
    await ensurePermission('salary:read')
    return <SalaryListClient />
}

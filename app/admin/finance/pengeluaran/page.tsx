import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './ExpenseClient'

export default async function ExpensePage() {
    await ensurePermission('expense:read')
    return <ExpenseClient />
}

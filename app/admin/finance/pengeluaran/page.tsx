import { ensurePermission } from '@/lib/rbac'
import { ExpenseClient } from './ExpenseClient'

export default async function ExpensePage() {
    await ensurePermission('expense:read')
    return <ExpenseClient />
}

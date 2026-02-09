import { ensureAnyPermission } from '@/lib/rbac'
import ExpensesClient from './ExpensesClient'

export const metadata = {
  title: 'Pengeluaran Site',
}

export default async function ExpensesPage() {
  await ensureAnyPermission(['mixradius_expenses:read', 'expense:read'])
  return <ExpensesClient />
}

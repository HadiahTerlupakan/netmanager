import { ensurePermission } from '@/lib/rbac'
import UserList from './UserList'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  await ensurePermission('users:read')

  return <UserList />
}

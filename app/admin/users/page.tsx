import { ensurePermission } from '@/lib/rbac'
import UserList from './UserList'

export const dynamic = 'force-dynamic'

export default async function UsersPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await ensurePermission('users:read')
  const searchParams = await props.searchParams

  return <UserList key={JSON.stringify(searchParams)} />
}

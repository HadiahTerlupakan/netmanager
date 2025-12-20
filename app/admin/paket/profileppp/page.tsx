import { ensurePermission } from '@/lib/rbac'
import ProfilePppList from './ProfilePppList'

export const dynamic = 'force-dynamic'

export default async function ProfilePppPage() {
    await ensurePermission('profileppp:read')

    return <ProfilePppList />
}

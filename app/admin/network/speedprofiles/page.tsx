import { ensurePermission } from '@/lib/rbac'
import SpeedProfileList from './SpeedProfileList'

export const dynamic = 'force-dynamic'

export default async function SpeedProfilePage() {
    await ensurePermission('speedprofile:read')

    return <SpeedProfileList />
}

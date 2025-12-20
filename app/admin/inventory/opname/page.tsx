import { ensurePermission } from '@/lib/rbac'
import OpnameList from './OpnameList'

export const dynamic = 'force-dynamic'

export default async function OpnamePage() {
    await ensurePermission('opname:read')

    return <OpnameList />
}

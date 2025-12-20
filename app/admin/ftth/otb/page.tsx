import { ensurePermission } from '@/lib/rbac'
import OtbList from './OtbList'

export const dynamic = 'force-dynamic'

export default async function OtbPage() {
    await ensurePermission('otb:read')

    return <OtbList />
}

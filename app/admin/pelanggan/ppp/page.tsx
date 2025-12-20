import { ensurePermission } from '@/lib/rbac'
import PppList from './PppList'

export const dynamic = 'force-dynamic'

export default async function PppPage() {
    await ensurePermission('ppp:read')

    return <PppList />
}

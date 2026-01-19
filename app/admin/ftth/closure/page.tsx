import { ensurePermission } from '@/lib/rbac'
import ClosureList from './ClosureList'

export const dynamic = 'force-dynamic'

export default async function ClosurePage({ 
    searchParams 
}: { 
    searchParams: Promise<{ siteId?: string }> 
}) {
    await ensurePermission('closure:read')
    const params = await searchParams

    return <ClosureList searchParams={params} />
}

import { ensurePermission } from '@/lib/rbac'
import PoleList from './PoleList'

export const dynamic = 'force-dynamic'

export default async function PolePage({ 
    searchParams 
}: { 
    searchParams: Promise<{ siteId?: string }> 
}) {
    await ensurePermission('pole:read')
    const params = await searchParams

    return <PoleList searchParams={params} />
}

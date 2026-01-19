import { ensurePermission } from '@/lib/rbac'
import OdpList from './OdpList'

export const dynamic = 'force-dynamic'

export default async function OdpPage({ 
    searchParams 
}: { 
    searchParams: Promise<{ siteId?: string }> 
}) {
    await ensurePermission('odp:read')
    const params = await searchParams

    return <OdpList searchParams={params} />
}

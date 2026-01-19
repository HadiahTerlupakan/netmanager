import { ensurePermission } from '@/lib/rbac'
import OdcList from './OdcList'

export const dynamic = 'force-dynamic'

export default async function OdcPage({ 
    searchParams 
}: { 
    searchParams: Promise<{ siteId?: string }> 
}) {
    await ensurePermission('odc:read')
    const params = await searchParams

    return <OdcList searchParams={params} />
}

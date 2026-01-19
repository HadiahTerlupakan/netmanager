import { ensurePermission } from '@/lib/rbac'
import OtbList from './OtbList'

export const dynamic = 'force-dynamic'

export default async function OtbPage({ 
    searchParams 
}: { 
    searchParams: Promise<{ siteId?: string }> 
}) {
    await ensurePermission('otb:read')
    const params = await searchParams

    return <OtbList searchParams={params} />
}

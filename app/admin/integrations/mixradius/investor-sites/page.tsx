import { ensurePermission } from '@/lib/rbac'
import SiteInvestorClient from './SiteInvestorClient'

export const dynamic = 'force-dynamic'

export default async function SiteInvestorPage() {
    await ensurePermission('mixradius_sites:read')

    return <SiteInvestorClient />
}

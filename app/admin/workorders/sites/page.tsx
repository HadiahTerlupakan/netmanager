import { ensurePermission } from '@/lib/rbac'
import SitesList from './SitesList'

export const dynamic = 'force-dynamic'

export default async function SitesPage() {
    await ensurePermission('site:read')

    return <SitesList />
}

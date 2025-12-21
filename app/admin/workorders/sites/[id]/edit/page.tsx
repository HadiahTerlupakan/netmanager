import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './SitesEditClient'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('sites:update')
    return <ClientComponent params={params} />
}

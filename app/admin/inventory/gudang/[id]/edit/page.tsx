import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './GudangEditClient'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('gudang:update')
    return <ClientComponent params={params} />
}

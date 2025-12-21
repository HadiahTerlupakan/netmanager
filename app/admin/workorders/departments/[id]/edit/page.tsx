import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './DeptEditClient'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('departments:update')
    return <ClientComponent params={params} />
}

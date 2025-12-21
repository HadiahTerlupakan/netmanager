import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './ClosureEditClient'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('closure:update')
    return await ClientComponent({ params })
}

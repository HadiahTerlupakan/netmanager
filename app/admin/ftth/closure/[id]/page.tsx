import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './ClosureDetailClient'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('closure:read')
    return await ClientComponent({ params })
}

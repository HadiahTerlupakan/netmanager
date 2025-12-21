import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './PoleDetailClient'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('pole:read')
    return await ClientComponent({ params })
}

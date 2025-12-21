import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './OtbDetailClient'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('otb:read')
    return await ClientComponent({ params })
}

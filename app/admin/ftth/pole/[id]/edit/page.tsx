import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './PoleEditClient'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('pole:update')
    return await ClientComponent({ params })
}
